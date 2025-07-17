const userModel = require('../models/user.models')
const userService = require('../userService/user.service')
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt')
const { validationResult } = require('express-validator')
const amqp = require('amqplib');
const mongoose = require('mongoose');
const Stripe = require('stripe');
const async = require('async');

const winston = require('winston');
const Joi = require('joi');
const dotenv = require('dotenv');
dotenv.config();

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);




// module.exports.googleLogin = async (req, res) => {
//   try {
//     const { idToken, email, fullname, profileImageLink } = req.body;

//     // Verify Google ID token
//     const ticket = await client.verifyIdToken({
//       idToken,
//       audience: process.env.GOOGLE_CLIENT_ID,
//     });

//     const payload = ticket.getPayload();
//     if (payload.email !== email) {
//       return res.status(401).json({ error: 'Invalid Google token' });
//     }

//     // Check if user exists
//     let user = await userModel.findOne({ email });
//     if (!user) {
//       // Create new user
//       const hashedPassword = await userModel.hashPassword(Math.random().toString(36).slice(-8)); // Generate random password
//       user = await userService.createUser({
//         firstname: fullname.firstname,
//         lastname: fullname.lastname,
//         email,
//         password: hashedPassword,
//         profileImageLink: profileImageLink || '',
//         phoneNumber: '',
//       });
//     }

//     // Generate JWT token
//     const token = user.generateAuthTken();

//     // Respond with user data and token
//     const { password: _, ...userWithoutPassword } = user.toObject();
//     res.status(200).json({ token, user: userWithoutPassword });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Google login failed' });
//   }
// };




module.exports.verifyme = async (req, res, next) => {
    try {
        // Retrieve auth token from request headers
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization token is required' });
        }

        const token = authHeader.split(' ')[1]; // Extract token from 'Bearer <token>'
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY); // Verify JWT

        // Find the user in the database
        const user = await userModel.findOne({ email: decoded.email }).select('-password'); // Exclude password

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return user details (excluding password)
        res.status(200).json({ message: 'User is verified', user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};



module.exports.registerUser = async (req, res, next) => {
    try {
        const err = validationResult(req)
        if (!err.isEmpty()) {
            const errorMessages = err.array().map(error => error.msg); // Extract error messages
            console.log(errorMessages)
            return res.status(400).json({ error: errorMessages });    // Send as array
          }
          
        const {fullname , email , password, profileImageLink, phoneNumber}=req.body

        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "Email already exists" });
        }



        const hashedPassword = await userModel.hashPassword(password)
        const user = await userService.createUser({
            firstname:fullname.firstname,
            lastname:fullname.lastname,
            email,
            password:hashedPassword,
            profileImageLink:'',
            phoneNumber, 

        })
        const token = user.generateAuthTken();
        // const savedUser = await user.save();
        // console.log(savedUser)
        res.status(201).json({token,user})
    } catch (error) {
        console.log(error)
        res.status(400).json({ error: 'Failed to create user' });
    }
    
};









module.exports.login = async (req, res, next) => {
    try {
        // Validate request body
        const err = validationResult(req);
        if (!err.isEmpty()) {
            const errorMessages = err.array().map(error => error.msg); // Extract error messages
            console.log(errorMessages)
            return res.status(400).json({ error: errorMessages });    // Send as array
          }

        const { email, password } = req.body;

        // Find user by email
        const existingUser = await userModel.findOne({ email }).select('+password'); // Include password explicitly
        
        
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Match password
        const isPasswordCorrect = await existingUser.comparePassword(password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ message: 'Incorrect password' });
        }

        // Generate JWT token
        const token = existingUser.generateAuthTken();

        // Respond with user data and token (exclude sensitive fields)
        const { password: _, ...userWithoutPassword } = existingUser.toObject();
        res.status(200).json({ token, user: userWithoutPassword });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};






module.exports.updateProfileImage = async (req, res) => {
  try {
    // Get authorization token from the request headers
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization token is required' });
    }

    const token = authHeader.split(' ')[1]; // Extract token from 'Bearer <token>'
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY); // Decode the token

    const email = decoded.email; // Get the email from the decoded token
    
    // Validate input
    const { imageUrl } = req.body;
    console.log(imageUrl)
    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({ error: 'Valid image URL is required' });
    }

    // Find user by email
    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update the user's profileImageLink field
    const updatedUser = await userModel.findByIdAndUpdate(
      user._id, 
      { profileImageLink: imageUrl },
      { new: true } // Return updated user
    );

    // Respond with updated user info
    res.status(200).json({ message: 'Profile image updated successfully', updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};



module.exports.deleteProfileImage = async (req, res) => {
    try {
      // Get authorization token from the request headers
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Authorization token is required' });
      }
  
      const token = authHeader.split(' ')[1]; // Extract token from 'Bearer <token>'
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY); // Decode the token
  
      const email = decoded.email; // Get the email from the decoded token
  
      // Find user by email
      const user = await userModel.findOne({ email });
  
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Update the user's profileImageLink field to an empty string
      user.profileImageLink = "";
      await user.save();
  
      res.status(200).json({ message: 'Profile image deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
  




module.exports.deleteUser = async (req, res, next) => {
    try {
        // Extract auth token from headers
        const token = req.headers.authorization?.split(" ")[1]; // Assumes Bearer token format
        const { password } = req.body; // Password provided in the request body
        
        // Validate inputs
        if (!token) {
            return res.status(401).json({ error: 'Authorization token is required' });
        }
        if (!password) {
            return res.status(400).json({ error: 'Password is required to delete the user' });
        }

        // Decode the token to get the user's email
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const email = decoded.email; // Assuming `email` is included in the token payload
        if (!email) {
            return res.status(400).json({ error: 'Invalid token: Email not found' });
        }

        // Find the user by email
        const user = await userModel.findOne({ email }).select('+password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Compare the provided password with the stored hashed password
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        // Delete the user
        const deletedUser = await userModel.findOneAndDelete({ email });
        if (!deletedUser) {
            return res.status(500).json({ error: 'Failed to delete user' });
        }

        // Respond with success message
        res.status(200).json({ message: 'User deleted successfully', user: deletedUser });
    } catch (error) {
        console.error(error);

        // Handle specific JWT errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }

        res.status(500).json({ error: 'Internal Server Error' });
    }
};



module.exports.AddItemToCart = async (req, res) => {
    try {
        console.log("msg fron user service additemtocart control")
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization token is required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const email = decoded.email;

        const { itemId, quantity } = req.body;

        if (!itemId || !quantity || quantity < 1) {
            return res.status(400).json({ error: 'Invalid itemId or quantity' });
        }

        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if item already exists in the cart
        const existingItemIndex = user.cart.findIndex((item) => item.itemId.toString() === itemId);

        if (existingItemIndex !== -1) {
            // Item exists, update the quantity
            user.cart[existingItemIndex].quantity++;
            console.log("msg fron user service additemtocart control - item quan inc by one")
        } else {
            // Item doesn't exist, add it to the cart
            user.cart.push({ itemId, quantity });
        }

        await user.save();
        console.log("msg fron user service additemtocart control")
        res.status(200).json({ message: 'Item added to cart', cart: user.cart });
    } catch (error) {
        console.log("msg fron user service additemtocart control")        
        console.error(error);

        res.status(500).json({ error: 'Failed to add item to cart' });
    }
};



module.exports.UpdateItemQuantityInCart = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization token is required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const email = decoded.email;

        const { itemId, operation } = req.body;

        if (!itemId || ![1, -1].includes(operation)) {
            return res.status(400).json({ error: 'Invalid itemId or operation value' });
        }
        var utoken = 'none';
        let updateQuery;
        if (operation === 1) {
            // Increment item quantity
            updateQuery = { $inc: { 'cart.$.quantity': 1 } };
            utoken='incremented'
        } else if (operation === -1) {
            // Decrement item quantity or remove item if quantity becomes 0
            const user = await userModel.findOne({ email, 'cart.itemId': itemId });

            if (!user) {
                return res.status(404).json({ error: 'Item not found in cart or user does not exist',utoken });
            }

            const cartItem = user.cart.find(item => item.itemId.toString() === itemId);

            if (!cartItem) {
                return res.status(404).json({ error: 'Item not found in cart',utoken });
            }

            if (cartItem.quantity === 1) {
                // If quantity becomes 0, remove the item from the cart
                await userModel.updateOne(
                    { email },
                    { $pull: { cart: { itemId } } }
                );
                utoken = 'deleted'
                return res.status(200).json({ message: 'Item removed from cart', utoken });
            }

            // Decrement the quantity
            updateQuery = { $inc: { 'cart.$.quantity': -1 } };
            utoken = 'decremented'
        }

        // Update the cart item quantity
        const user = await userModel.findOneAndUpdate(
            { email, 'cart.itemId': itemId },
            updateQuery,
            { new: true }
        ) // Optional: populate item details

        if (!user) {
            return res.status(404).json({ error: 'Item not found in cart or user does not exist',utoken });
        }

        res.status(200).json({ message: 'Item quantity updated successfully', utoken });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update item quantity in cart' });
    }
};








// Add or Remove Item from the Wishlist
module.exports.ToggleWishlistItem = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization token is required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const email = decoded.email;

        const { itemId } = req.body;

        if (!itemId) {
            return res.status(400).json({ error: 'Invalid itemId' });
        }

        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if the item already exists in the wishlist
        const existingItemIndex = user.wishlist.findIndex((item) => item.itemId.toString() === itemId);

        if (existingItemIndex !== -1) {
            // Item exists, remove it from the wishlist
            user.wishlist.splice(existingItemIndex, 1);
            await user.save();
            return res.status(200).json({ message: 'Item removed from wishlist', wishlist: user.wishlist });
        } else {
            // Item doesn't exist, add it to the wishlist
            user.wishlist.push({ itemId });
            await user.save();
            return res.status(200).json({ message: 'Item added to wishlist', wishlist: user.wishlist });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update wishlist' });
    }
};

module.exports.MoveItemToWishlist = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization token is required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const email = decoded.email;

        const { itemId } = req.body;
        let utoken = "none";

        if (!itemId) {
            return res.status(400).json({ error: 'Invalid itemId', utoken });
        }

        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'User not found', utoken });
        }

        // Check if the item exists in the cart
        const cartIndex = user.cart.findIndex((item) => item.itemId.toString() === itemId);

        if (cartIndex === -1) {
            utoken = 'Item not found in cart';
            return res.status(404).json({ error: 'Item not found in cart', utoken });
        }

        // Check if the item already exists in the wishlist
        const wishlistExists = user.wishlist.some(
            (wishlistItem) => wishlistItem.itemId.toString() === itemId
        );

        if (!wishlistExists) {
            // Add the item to the wishlist (push the object with itemId)
            user.wishlist.push({
                itemId: itemId // itemId is stored as an ObjectId
            });
        }

        // Remove the item from the cart
        user.cart.splice(cartIndex, 1);

        // Save the updated user document
        await user.save();
        utoken = 'Item moved to wishlist';
        res.status(200).json({ message: 'Item moved to wishlist', utoken });
    } catch (error) {
        console.error(error);
        utoken = 'Failed to move item to wishlist';
        res.status(500).json({ error: 'Failed to move item to wishlist', utoken });
    }
};



// Remove item from the cart
module.exports.RemoveItemFromCart = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization token is required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const email = decoded.email;

        const { itemId } = req.body;

        const user = await userModel.findOneAndUpdate(
            { email },
            { $pull: { cart: { itemId } } }, // Remove item from cart
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({ message: 'Item removed from cart', cart: user.cart });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to remove item from cart' });
    }
};



// Remove item from the wishlist
module.exports.RemoveItemFromWishlist = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization token is required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const email = decoded.email;

        const { itemId } = req.body;

        if (!itemId) {
            return res.status(400).json({ error: 'Item ID is required to remove from wishlist' });
        }

        const user = await userModel.findOneAndUpdate(
            { email },
            { $pull: { wishlist: { itemId } } }, // Remove item from wishlist
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({ message: 'Item removed from wishlist', wishlist: user.wishlist });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to remove item from wishlist' });
    }
};


////// this was the previous code for show cart to stand alone communicate to database
// module.exports.ShowCart = async (req, res) => {
//     try {
//         const authHeader = req.headers.authorization;
//         if (!authHeader) {
//             return res.status(401).json({ error: 'Authorization token is required' });
//         }

//         const token = authHeader.split(' ')[1];
//         const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
//         const email = decoded.email;

//         const user = await userModel.findOne({ email }).populate('cart.itemId', 'name description price availableQuantity'); // Adjust fields as per your `Item` model

//         if (!user) {
//             return res.status(404).json({ error: 'User not found' });
//         }

//         res.status(200).json({ message: 'Cart retrieved successfully', cart: user.cart });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Failed to retrieve cart' });
//     }
// };







//////////xx/////////// this is the code for show cart to communicate with item service without any 3rd party amqp
// const axios = require('axios');

// module.exports.ShowCart = async (req, res) => {
//     try {
//         const authHeader = req.headers.authorization;
//         if (!authHeader) {
//             return res.status(401).json({ error: 'Authorization token is required' });
//         }

//         const token = authHeader.split(' ')[1];
//         const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
//         const email = decoded.email;

//         const user = await userModel.findOne({ email });

//         if (!user) {
//             return res.status(404).json({ error: 'User not found' });
//         }

//         const itemIds = user.cart.map((item) => item.itemId);

//         // Fetch item details from Server 2
//         const response = await axios.post('http://localhost:3002/item/itemsDetailsForUser', { itemIds });

//         const itemsDetails = response.data.items;

//         // Merge item details into the user's cart
//         const cartWithDetails = user.cart.map((cartItem) => {
//             const itemDetail = itemsDetails.find((item) => item._id.toString() === cartItem.itemId.toString());
//             return {
//                 ...cartItem.toObject(),
//                 itemDetail,
//             };
//         });

//         res.status(200).json({ message: 'Cart retrieved successfully', cart: cartWithDetails });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Failed to retrieve cart' });
//     }
// };

































































/////amqp 
// module.exports.ShowCart = async (req, res) => {
//     try {
//       const authHeader = req.headers.authorization;
//       if (!authHeader) {
//         return res.status(401).json({ error: 'Authorization token is required' });
//       }
  
//       const token = authHeader.split(' ')[1];
//       const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
//       const email = decoded.email;
  
//       const user = await userModel.findOne({ email });
  
//       if (!user) {
//         return res.status(404).json({ error: 'User not found' });
//       }
  
//       const itemIds = user.cart.map((item) => item.itemId);
  
//       // Connect to RabbitMQ and send a message to the 'item-request' queue
//       const connection = await amqp.connect('amqps://spogxdre:xsftHXmfeGSJlWsfCYVAnF1g6AXSlmuI@kebnekaise.lmq.cloudamqp.com/spogxdre', {
//         heartbeat: 60
//       });
//       const channel = await connection.createChannel();
//       console.log("Connected to RabbitMQ-----",channel);
//       const requestQueue = 'item-request';
//       const replyQueue = 'item-response'; // Response queue for the item details
  
//       await channel.assertQueue(requestQueue, { durable: true });
//       await channel.assertQueue(replyQueue, { durable: true });
  
//       // Send itemIds as the message to the 'item-request' queue, and specify the reply-to queue
//       const correlationId = generateUuid(); // Create a unique correlation ID for tracking

//       const cartItems = user.cart.map(item => ({
//         itemId: item.itemId,
//         quantity: item.quantity // Use the actual quantity from the user's cart
//       }));


//       console.log({ cartItems, userId: user._id },"==============================================")
//       channel.sendToQueue(requestQueue, Buffer.from(JSON.stringify({ cartItems, userId: user._id })),
//         {
//           persistent: true,
//           replyTo: replyQueue,  // Specify where to send the response
//           correlationId: correlationId  // Used for matching request and response
//         });
  
//       console.log("Sent item request message to queue:", { cartItems, userId: user._id });
//         console.log("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
//       // Listen for the response from the Item Service
//       channel.consume(replyQueue, (msg) => {
//         console.log("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
//         if (msg.properties.correlationId === correlationId) {
//           const cartWithDetails = JSON.parse(msg.content.toString());
//           console.log("Received item response message from queue:", cartWithDetails);
//           console.log("cccccccccccccccccccccccccccccccccccccc")
//           res.status(200).json({
//             message: 'Cart retrieved successfully',
//             cart: cartWithDetails
//           });
//           channel.close();
//           connection.close();
//         }
//       }, { noAck: true });
  
//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: 'Failed to retrieve cart' });
//     }
//   };
  


const { v4: uuidv4 } = require('uuid');

let channel = null;

async function initializeRabbitMQ() {
  const connection = await amqp.connect('amqps://spogxdre:xsftHXmfeGSJlWsfCYVAnF1g6AXSlmuI@kebnekaise.lmq.cloudamqp.com/spogxdre', { heartbeat: 60 });
  channel = await connection.createChannel();
  await channel.assertQueue('item-requestx', { durable: true });
  await channel.assertQueue('item-request-wishlistx', { durable: true });
  return channel;
}

module.exports.ShowCart = async (req, res) => {
  console.log("-------------------showing cart--------------------")
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization token is required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await userModel.findOne({ email: decoded.email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.cart.length) {
      return res.status(200).json({ message: 'Cart is empty', cart: [] });
    }

    if (!channel) await initializeRabbitMQ();

    const requestQueue = 'item-requestx';
    const replyQueue = await channel.assertQueue('', { exclusive: true });
    const correlationId = uuidv4();
    const cartItems = user.cart.map(item => ({
      itemId: item.itemId,
      quantity: item.quantity
    }));

    channel.sendToQueue(requestQueue, Buffer.from(JSON.stringify({ cartItems, userId: user._id })), {
      persistent: true,
      replyTo: replyQueue.queue,
      correlationId
    });

    const timeout = setTimeout(() => {
      res.status(504).json({ error: 'Item service timeout' });
      channel.cancel(consumerTag);
    }, 5000);

    const { consumerTag } = await channel.consume(replyQueue.queue, (msg) => {
      if (msg.properties.correlationId === correlationId) {
        clearTimeout(timeout);
        const cartWithDetails = JSON.parse(msg.content.toString());
        res.status(200).json({
          message: 'Cart retrieved successfully',
          cart: cartWithDetails
        });
        channel.ack(msg);
        channel.cancel(consumerTag);
      }
    }, { noAck: false });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve cart' });
  }
};








































































// module.exports.ShowWishlist = async (req, res) => {
//     try {
//         const authHeader = req.headers.authorization;
//         if (!authHeader) {
//             return res.status(401).json({ error: 'Authorization token is required' });
//         }

//         const token = authHeader.split(' ')[1];
//         const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
//         const email = decoded.email;

//         const user = await userModel.findOne({ email });
//         if (!user) {
//             return res.status(404).json({ error: 'User not found' });
//         }

//         const wishlistItems = user.wishlist.map(item => ({
//             itemId: item.itemId,
//         }));

//         // Connect to RabbitMQ
//         const connection = await amqp.connect('amqps://spogxdre:xsftHXmfeGSJlWsfCYVAnF1g6AXSlmuI@kebnekaise.lmq.cloudamqp.com/spogxdre', {
//             heartbeat: 60
//           });
//         const channel = await connection.createChannel();
//         console.log("Connected to RabbitMQ   [][][][][][][][][][][][][][][][][][]",channel);
//         const requestQueue = 'item-request-wishlist';
//         const replyQueue = 'item-response-wishlist';

//         await channel.assertQueue(requestQueue, { durable: true });
//         await channel.assertQueue(replyQueue, { durable: true });

//         const correlationId = generateUuid();
//         console.log({ wishlistItems, userId: user._id },"==============================================")
//         // Send wishlist items to the Item Service
//         channel.sendToQueue(
//             requestQueue,
//             Buffer.from(JSON.stringify({ wishlistItems, userId: user._id })),
//             {
//                 persistent: true,
//                 replyTo: replyQueue,
//                 correlationId: correlationId
//             }
//         );

//         console.log("Sent wishlist request to queue:", { wishlistItems, userId: user._id });

//         // Listen for the response from the Item Service
//         channel.consume(replyQueue, (msg) => {
//             if (msg.properties.correlationId === correlationId) {
//                 const wishlistWithDetails = JSON.parse(msg.content.toString());
//                 console.log("Received wishlist response from queue:", wishlistWithDetails);

//                 res.status(200).json({
//                     message: 'Wishlist retrieved successfully',
//                     wishlist: wishlistWithDetails
//                 });

//                 channel.close();
//                 connection.close();
//             }
//         }, { noAck: true });

//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Failed to retrieve wishlist' });
//     }
// };





module.exports.ShowWishlist = async (req, res) => {
  try {

    console.log("===================whishlist callled=======================")
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization token is required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await userModel.findOne({ email: decoded.email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.wishlist.length) {
      return res.status(200).json({
        message: 'Wishlist is empty',
        wishlist: []
      });
    }

    if (!channel) await initializeRabbitMQ();

    const requestQueue = 'item-request-wishlistx';
    const replyQueue = await channel.assertQueue('', { exclusive: true });
    const correlationId = uuidv4();
    const wishlistItems = user.wishlist.map(item => ({
      itemId: item.itemId
    }));

    channel.sendToQueue(
      requestQueue,
      Buffer.from(JSON.stringify({ wishlistItems, userId: user._id })),
      {
        persistent: true,
        replyTo: replyQueue.queue,
        correlationId
      }
    );

    console.log('Sent wishlist request to queue:', { wishlistItems, userId: user._id });

    const timeout = setTimeout(() => {
      res.status(504).json({ error: 'Item service timeout' });
      channel.cancel(consumerTag);
    }, 5000);

    const { consumerTag } = await channel.consume(replyQueue.queue, (msg) => {
      if (msg.properties.correlationId === correlationId) {
        clearTimeout(timeout);
        const wishlistWithDetails = JSON.parse(msg.content.toString());
        res.status(200).json({
          message: 'Wishlist retrieved successfully',
          wishlist: wishlistWithDetails
        });
        channel.ack(msg);
        channel.cancel(consumerTag);
      }
    }, { noAck: false });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve wishlist' });
  }
};

// Generate a unique correlation ID for each request
function generateUuid() {
    return (Math.floor(Math.random() * 1e6)).toString(); // Ensure it's a string
}




































module.exports.MoveItemToCart = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization token is required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const email = decoded.email;

        const { itemId } = req.body;

        if (!itemId) {
            return res.status(400).json({ error: 'Invalid itemId' });
        }

        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if the item is in the wishlist
        const wishlistIndex = user.wishlist.findIndex((item) => item.itemId.toString() === itemId);

        if (wishlistIndex === -1) {
            return res.status(404).json({ error: 'Item not found in wishlist' });
        }

        // Remove the item from the wishlist
        const [removedItem] = user.wishlist.splice(wishlistIndex, 1);

        // Check if the item is already in the cart
        const cartIndex = user.cart.findIndex((cartItem) => cartItem.itemId.toString() === itemId);

        if (cartIndex === -1) {
            // Add the item to the cart with quantity 1
            user.cart.push({ itemId, quantity: 1 });
        } else {
            // If already in the cart, increase the quantity by 1
            user.cart[cartIndex].quantity += 1;
        }

        await user.save();

        res.status(200).json({
            message: 'Item moved from wishlist to cart successfully',
            cart: user.cart,
            wishlist: user.wishlist,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to move item to cart' });
    }
};




module.exports.profileImage = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization token is required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const email = decoded.email;

    } catch (error) {
      
    }
};












module.exports.getCartItemCount = async (req, res) => {
    console.log("msg fron user service getCartItemCount control")
    try {
      // Authenticate user
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Authorization token is required' });
      }
  
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      const email = decoded.email;
  
      // Find user by email
      const user = await userModel.findOne({ email });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Calculate total cart item count by summing quantities
      const cartCount = user.cart.reduce((total, item) => total + (item.quantity || 0), 0);
  
      res.status(200).json({
        message: 'Cart item count retrieved successfully',
        userId: user._id,
        cartCount,
      });
    } catch (error) {
      console.error('Error retrieving cart item count:', error);
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      } else if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };




  module.exports.getWishlistItemCount = async (req, res) => {
    console.log("msg fron user service getWishlistItemCount control")
    try {
      // Authenticate user
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Authorization token is required' });
      }
  
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      const email = decoded.email;
  
      // Find user by email
      const user = await userModel.findOne({ email });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Get wishlist item count
      const wishlistl = user.wishlist.length;
      

      res.status(200).json({
        message: 'Wishlist item count retrieved successfully',
        userId: user._id,
        wishlistl,
      });
    } catch (error) {
      console.error('Error retrieving wishlist item count:', error);
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      } else if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };






// get  all orders for the authenticated user
module.exports.getUserOrders = async (req, res) => {
    console.log("++++++++++++++++++++++++++++++++msg fron user service getUserOrders control")
    try {
      // Authenticate user
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Authorization token is required' });
      }
  
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      const email = decoded.email;
  
      // Find user by email and select orders
      const user = await userModel.findOne({ email }).select('orders');
  
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
  
      res.status(200).json({
        success: true,
        message: 'Orders retrieved successfully',
        orders: user.orders,
      });
    } catch (error) {
      console.error('Error retrieving user orders:', error);
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, error: 'Invalid token' });
      } else if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, error: 'Token expired' });
      }
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  };


































































  

// // Consumer to handle user verification requests (to be run in User Operations Server)
// async function startUserVerificationConsumer() {
//   console.log('Starting user verification consumer...');
//   let connection = null;
//   let channel = null;

//   try {
//     connection = await amqp.connect('amqps://spogxdre:xsftHXmfeGSJlWsfCYVAnF1g6AXSlmuI@kebnekaise.lmq.cloudamqp.com/spogxdre', { heartbeat: 60 });
//     channel = await connection.createChannel();
//     const requestQueue = 'user-verify-request';
//     const replyQueue = 'user-verify-response';

//     await channel.assertQueue(requestQueue, { durable: true });
//     await channel.assertQueue(replyQueue, { durable: true });

//     console.log('Waiting for user verification requests...');

//     channel.consume(requestQueue, async (msg) => {
//       console.log('Received user verification request:', msg.content.toString());
//       if (msg !== null) {
//         const { email, token } = JSON.parse(msg.content.toString());
//         const correlationId = msg.properties.correlationId;
//         const replyTo = msg.properties.replyTo;

//         try {
//           const user = await userModel
//             .findOne({ email })
//             .select('fullname email phoneNumber profileImageLink');
//           let response;

//           if (!user) {
//             response = { error: 'User not found' };
//           } else {
//             try {
//               const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
//               if (decoded.email !== email) {
//                 response = { error: 'Token does not match provided email' };
//               } else {
//                 response = {
//                   message: 'User verified successfully',
//                   user: {
//                     _id: user._id,
//                     fullName: `${user.fullname.firstname} ${user.fullname.lastname}`,
//                     email: user.email,
//                     phoneNumber: user.phoneNumber,
//                     profileImageLink: user.profileImageLink || '',
//                   },
//                 };
//               }
//             } catch (error) {
//               response = {
//                 error:
//                   error.name === 'JsonWebTokenError'
//                     ? 'Invalid token'
//                     : error.name === 'TokenExpiredError'
//                     ? 'Token expired'
//                     : 'Internal Server Error',
//               };
//             }
//           }
//           console.log('Sending response:', response);
//           channel.sendToQueue(replyTo, Buffer.from(JSON.stringify(response)), { correlationId });
//           channel.ack(msg);
//         } catch (error) {
//           console.error('Error processing user verification:', error);
//           channel.sendToQueue(
//             replyTo,
//             Buffer.from(JSON.stringify({ error: 'Internal Server Error' })),
//             { correlationId }
//           );
//           channel.ack(msg);
//         }
//       }
//     });
//   } catch (error) {
//     console.error('Error in user verification consumer:', error);
//     // Attempt to reconnect after a delay
//     setTimeout(startUserVerificationConsumer, 5000);
//   }
// }

// startUserVerificationConsumer();








// async function startOrderUpdateConsumer() {
//   console.log('Starting order update consumer...');
//   let connection = null;
//   let channel = null;

//   try {
//     connection = await amqp.connect('amqps://spogxdre:xsftHXmfeGSJlWsfCYVAnF1g6AXSlmuI@kebnekaise.lmq.cloudamqp.com/spogxdre', { heartbeat: 60 });
//     channel = await connection.createChannel();
//     const requestQueue = 'order-update-request';
//     const replyQueue = 'order-update-response';

//     await channel.assertQueue(requestQueue, { durable: true });
//     await channel.assertQueue(replyQueue, { durable: true });

//     console.log('Waiting for order update requests...');

//     channel.consume(requestQueue, async (msg) => {
//       if (msg !== null) {
//         console.log('Received order update request:', msg.content.toString());
//         const { userId, order } = JSON.parse(msg.content.toString());
//         const correlationId = msg.properties.correlationId;
//         const replyTo = msg.properties.replyTo;

//         let response;

//         try {
//           // Validate inputs
//           if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//             response = { error: 'Valid userId is required' };
//           } else if (
//             !order ||
//             !order.orderId ||
//             !mongoose.Types.ObjectId.isValid(order.orderId) ||
//             !order.items ||
//             !Array.isArray(order.items) ||
//             order.items.length === 0
//           ) {
//             response = { error: 'Valid order details (orderId, items) are required' };
//           } else {
//             // Validate items
//             for (const item of order.items) {
//               if (!item.itemId || !mongoose.Types.ObjectId.isValid(item.itemId) || !item.quantity || item.quantity < 1) {
//                 response = { error: 'Each item must have a valid itemId and quantity' };
//                 break;
//               }
//             }

//             if (!response) {
//               // Update user's orders array
//               const user = await userModel.findByIdAndUpdate(
//                 userId,
//                 {
//                   $push: {
//                     orders: {
//                       orderId: order.orderId,
//                       items: order.items.map(item => ({
//                         itemId: item.itemId,
//                         quantity: item.quantity,
//                       })),
//                       status: order.status || 'Order Placed',
//                       paymentOption: order.paymentOption || 1,
//                       address: order.address || '',
//                     },
//                   },
//                 },
//                 { new: true }
//               );

//               if (!user) {
//                 response = { error: 'User not found' };
//               } else {
//                 response = {
//                   message: 'Order added to user successfully',
//                   userId: user._id,
//                 };
//               }
//             }
//           }

//           console.log('Sending order update response:', response);
//           channel.sendToQueue(replyTo, Buffer.from(JSON.stringify(response)), { correlationId });
//           channel.ack(msg);
//         } catch (error) {
//           console.error('Error processing order update:', error);
//           response = { error: 'Internal Server Error' };
//           channel.sendToQueue(replyTo, Buffer.from(JSON.stringify(response)), { correlationId });
//           channel.ack(msg);
//         }
//       }
//     });

//     // Handle connection errors
//     connection.on('error', (err) => {
//       console.error('AMQP connection error:', err);
//       channel = null;
//       connection = null;
//       setTimeout(startOrderUpdateConsumer, 5000);
//     });

//     connection.on('close', () => {
//       console.log('AMQP connection closed');
//       channel = null;
//       connection = null;
//       setTimeout(startOrderUpdateConsumer, 5000);
//     });
//   } catch (error) {
//     console.error('Error in order update consumer:', error);
//     setTimeout(startOrderUpdateConsumer, 5000);
//   }
// }

// // Start the order update consumer
// startOrderUpdateConsumer();








// // Start AMQP consumer for order updates
// async function startOrderStatusUpdateConsumer() {
//   console.log('Starting startOrderStatusUpdateConsumer update consumer...');
//   let connection = null;
//   let channel = null;
//   try {
//       connection = await amqp.connect('amqps://spogxdre:xsftHXmfeGSJlWsfCYVAnF1g6AXSlmuI@kebnekaise.lmq.cloudamqp.com/spogxdre', { heartbeat: 60 });
//       channel = await connection.createChannel();
//     const orderUpdateRequestQueue = 'orderStatus-update-request';
//     const orderUpdateReplyQueue = 'orderStatus-update-response';

//     await channel.assertQueue(orderUpdateRequestQueue, { durable: true });
//     await channel.assertQueue(orderUpdateReplyQueue, { durable: true });

//     channel.consume(orderUpdateRequestQueue, async (msg) => {
//       const { userId, order } = JSON.parse(msg.content.toString());
//       const correlationId = msg.properties.correlationId;
//       console.log('Received order update request:', { userId, order });
//       try {
//         if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(order.orderId)) {
//           channel.sendToQueue(
//             orderUpdateReplyQueue,
//             Buffer.from(JSON.stringify({ success: false, error: 'Invalid userId or orderId' })),
//             { correlationId }
//           );
//           channel.ack(msg);
//           return;
//         }

//         const user = await userModel.findOneAndUpdate(
//           { _id: userId, 'orders.orderId': order.orderId },
//           { $set: { 'orders.$.status': order.status } },
//           { new: true }
//         );
//         console.log('User query result:', user ? user._id.toString() : 'null');

//         if (!user) {
//           console.log('User or order not found for userID:', userId, 'and orderId:', order.orderId);
//           channel.sendToQueue(
//             orderUpdateReplyQueue,
//             Buffer.from(JSON.stringify({ success: false, error: 'User or order not found' })),
//             { correlationId }
//           );
//         } else {
//           console.log('Order status updated successfully for userID:', userId, 'and orderId:', order.orderId);
//           console.log('Updated order status:', order.status);
//           channel.sendToQueue(
//             orderUpdateReplyQueue,
//             Buffer.from(JSON.stringify({ success: true, message: 'Order status updated in user_db' })),
//             { correlationId }
//           );
//         }
//       } catch (error) {
//         console.error('Error updating user order status:', error);
//         channel.sendToQueue(
//           orderUpdateReplyQueue,
//           Buffer.from(JSON.stringify({ success: false, error: 'Internal Server Error' })),
//           { correlationId }
//         );
//       }

//       channel.ack(msg);
//     });
//     console.log('AMQP consumer started for order-update-request');
//   } catch (error) {
//     console.error('Error starting AMQP consumer:', error);
//   }
// }

// // Start consumer when server starts
// startOrderStatusUpdateConsumer();





// // Start AMQP consumer for order updates
// async function startOrderCancellationStatusUpdateConsumer() {
// console.log('Starting startOrderCancellationStatusUpdateConsumer update consumer........................................................................................................................................');
// let connection = null;
// let channel = null;
// try {
//   connection = await amqp.connect('amqps://spogxdre:xsftHXmfeGSJlWsfCYVAnF1g6AXSlmuI@kebnekaise.lmq.cloudamqp.com/spogxdre', { heartbeat: 60 });
//   channel = await connection.createChannel();
//   const orderUpdateRequestQueue = 'orderCStatus-update-request';
//   const orderUpdateReplyQueue = 'orderCStatus-update-response';

//   await channel.assertQueue(orderUpdateRequestQueue, { durable: true });
//   await channel.assertQueue(orderUpdateReplyQueue, { durable: true });
//   console.log("reached here 1")
//   channel.consume(orderUpdateRequestQueue, async (msg) => {
//     console.log('Message received from queue:', msg.content.toString());
//     const { userId, order } = JSON.parse(msg.content.toString());
//     console.log('Parsed message:', { userId, order });
    
    
//     console.log("=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=",userId,order)
//     const correlationId = msg.properties.correlationId;
//     console.log('Received order update request:', { userId, order });
//     try {
//       if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(order.orderId)) {
//         channel.sendToQueue(
//           orderUpdateReplyQueue,
//           Buffer.from(JSON.stringify({ success: false, error: 'Invalid userId or orderId' })),
//           { correlationId }
//         );
//         channel.ack(msg);
//         return;
//       }
//       const cancleOrderStatusNumberMap = {
//         'Normal': 0,
//         'Cancellation Requested': 1,
//         'Cancelled by Admin': 2,
//       };
//       const user = await userModel.findOneAndUpdate(
//         { _id: userId, 'orders.orderId': order.orderId },
//         { $set: { 'orders.$.Cstatus': cancleOrderStatusNumberMap[order.Cstatus] } },
//         { new: true }
//       );
//       console.log('User query result:', user ? user._id.toString() : 'null');

//       if (!user) {
//         console.log('User or order not found for userID:', userId, 'and orderId:', order.orderId);
//         channel.sendToQueue(
//           orderUpdateReplyQueue,
//           Buffer.from(JSON.stringify({ success: false, error: 'User or order not found' })),
//           { correlationId }
//         );
//       } else {
//         console.log('Order status updated successfully for userID:', userId, 'and orderId:', order.orderId);
//         console.log('Updated order status:', order.Cstatus);
//         channel.sendToQueue(
//           orderUpdateReplyQueue,
//           Buffer.from(JSON.stringify({ success: true, message: 'Order status updated in user_db' })),
//           { correlationId }
//         );
//       }
//     } catch (error) {
//       console.error('Error updating user order status:', error);
//       channel.sendToQueue(
//         orderUpdateReplyQueue,
//         Buffer.from(JSON.stringify({ success: false, error: 'Internal Server Error' })),
//         { correlationId }
//       );
//     }

//     channel.ack(msg);
//   });
//   console.log('AMQP consumer started for order-update-request');
// } catch (error) {
//   console.error('Error starting AMQP consumer:', error);
//   console.error('Error starting AMQP consumer:::::::::::::::::::::::::::::::::::::::::::::::', error.message, error.stack);
// }
// }

// // Start consumer when server starts
// startOrderCancellationStatusUpdateConsumer();




// // New consumer: Handle order deletion requests
// async function startOrderDeletionConsumer() {
// console.log('Starting order deletion consumer...');
// let connection = null;
// let channel = null;
// try {
//   connection = await amqp.connect('amqps://spogxdre:xsftHXmfeGSJlWsfCYVAnF1g6AXSlmuI@kebnekaise.lmq.cloudamqp.com/spogxdre', { heartbeat: 60 });
//   channel = await connection.createChannel();
//   const requestQueue = 'order-delete-request';
//   const replyQueue = 'order-delete-response';
//   await channel.assertQueue(requestQueue, { durable: true });
//   await channel.assertQueue(replyQueue, { durable: true });
//   console.log('Waiting for order deletion requests...');
//   channel.consume(requestQueue, async (msg) => {
//     if (msg !== null) {
//       console.log('Received order deletion request:', msg.content.toString());
//       const { userId, orderId } = JSON.parse(msg.content.toString());
//       const correlationId = msg.properties.correlationId;
//       const replyTo = msg.properties.replyTo;
//       let response;
//       try {
//         if (!userId || !mongoose.Types.ObjectId.isValid(userId) || !orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
//           response = { error: 'Valid userId and orderId are required' };
//         } else {
//           const user = await userModel.findOneAndUpdate(
//             { _id: userId, 'orders.orderId': orderId },
//             { $pull: { orders: { orderId } } },
//             { new: true }
//           );
//           if (!user) {
//             response = { error: 'User or order not found' };
//           } else {
//             response = {
//               message: 'Order deleted from user successfully',
//               userId,
//               orderId,
//             };
//           }
//         }
//         console.log('Sending order deletion response:', response);
//         channel.sendToQueue(replyTo, Buffer.from(JSON.stringify(response)), { correlationId });
//         channel.ack(msg);
//       } catch (error) {
//         console.error('Error processing order deletion:', error);
//         response = { error: 'Internal Server Error' };
//         channel.sendToQueue(replyTo, Buffer.from(JSON.stringify(response)), { correlationId });
//         channel.ack(msg);
//       }
//     }
//   });
//   connection.on('error', (err) => {
//     console.error('AMQP connection error:', err);
//     channel = null;
//     connection = null;
//     setTimeout(startOrderDeletionConsumer, 5000);
//   });
//   connection.on('close', () => {
//     console.log('AMQP connection closed');
//     channel = null;
//     connection = null;
//     setTimeout(startOrderDeletionConsumer, 5000);
//   });
// } catch (error) {
//   console.error('Error in order deletion consumer:', error);
//   setTimeout(startOrderDeletionConsumer, 5000);
// }
// }
// startOrderDeletionConsumer()











const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'user-service.log' }),
    new winston.transports.Console()
  ]
});

const userVerifySchema = Joi.object({
  email: Joi.string().email().required(),
  token: Joi.string().required()
});

const orderUpdateSchema = Joi.object({
  userId: Joi.string().required(),
  order: Joi.object({
    orderId: Joi.string().required(),
    items: Joi.array().items(
      Joi.object({
        itemId: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required()
      })
    ).min(1).required(),
    status: Joi.string().optional(),
    Cstatus: Joi.string().optional(),
    paymentOption: Joi.number().integer().min(1).optional(),
    address: Joi.string().optional()
  }).required()
});

const orderStatusUpdateSchema = Joi.object({
  userId: Joi.string().required(),
  order: Joi.object({
    orderId: Joi.string().required(),
    status: Joi.string().valid('Processing', 'Shipped', 'Delivered', 'Cancelled').required()
  }).required()
});

const orderCancelStatusUpdateSchema = Joi.object({
  userId: Joi.string().required(),
  order: Joi.object({
    orderId: Joi.string().required(),
    Cstatus: Joi.string().valid('Normal', 'Cancellation Requested', 'Cancelled by Admin').required()
  }).required()
});

const orderDeleteSchema = Joi.object({
  userId: Joi.string().required(),
  orderId: Joi.string().required()
});

async function startUserVerificationConsumer() {
  let connection = null;
  let channel = null;

  const connect = async () => {
    try {
      connection = await amqp.connect(process.env.RABBITMQ_URL, { heartbeat: 60 });
      channel = await connection.createChannel();
      channel.prefetch(10);
      await channel.assertQueue('user-verify-request', { durable: true });
      logger.info('User verification consumer initialized');

      connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err);
        channel = null;
        connection = null;
        setTimeout(connect, 5000);
      });

      connection.on('close', () => {
        logger.warn('RabbitMQ connection closed, attempting to reconnect');
        channel = null;
        connection = null;
        setTimeout(connect, 5000);
      });

      return channel;
    } catch (err) {
      logger.error('Failed to initialize RabbitMQ:', err);
      setTimeout(connect, 5000);
      throw err;
    }
  };

  try {
    const channel = await connect();
    const requestQueue = 'user-verify-request';

    logger.info('Waiting for user verification requests');

    channel.consume(requestQueue, async (msg) => {
      if (msg === null) {
        logger.warn('Received null message');
        return;
      }

      const correlationId = msg.properties.correlationId;
      const replyTo = msg.properties.replyTo;

      try {
        const { email, token } = JSON.parse(msg.content.toString());
        const { error } = userVerifySchema.validate({ email, token });
        if (error) {
          logger.warn('Invalid message format', { error: error.message, correlationId });
          channel.sendToQueue(
            replyTo,
            Buffer.from(JSON.stringify({ error: 'Invalid message format' })),
            { correlationId }
          );
          channel.ack(msg);
          return;
        }

        const user = await async.retry(
          { times: 3, interval: 1000 },
          async () => await userModel.findOne({ email }).select('fullname email phoneNumber profileImageLink')
        );

        let response;
        if (!user) {
          logger.warn('User not found', { email, correlationId });
          response = { error: 'User not found' };
        } else {
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
            if (decoded.email !== email) {
              logger.warn('Token email mismatch', { email, decodedEmail: decoded.email, correlationId });
              response = { error: 'Token does not match provided email' };
            } else {
              response = {
                message: 'User verified successfully',
                user: {
                  _id: user._id,
                  fullName: `${user.fullname.firstname} ${user.fullname.lastname}`,
                  email: user.email,
                  phoneNumber: user.phoneNumber,
                  profileImageLink: user.profileImageLink || ''
                }
              };
            }
          } catch (error) {
            logger.warn('Token verification failed', { error: error.message, correlationId });
            response = {
              error:
                error.name === 'JsonWebTokenError'
                  ? 'Invalid token'
                  : error.name === 'TokenExpiredError'
                  ? 'Token expired'
                  : 'Internal Server Error'
            };
          }
        }

        logger.info('Sending user verification response', { response, correlationId });
        channel.sendToQueue(replyTo, Buffer.from(JSON.stringify(response)), { correlationId });
        channel.ack(msg);
      } catch (error) {
        logger.error('Error processing user verification', { error: error.message, correlationId });
        channel.sendToQueue(
          replyTo,
          Buffer.from(JSON.stringify({ error: 'Internal Server Error' })),
          { correlationId }
        );
        channel.ack(msg);
      }
    }, { noAck: false });

    process.on('SIGINT', async () => {
      if (channel) {
        await channel.close();
        logger.info('User verification consumer channel closed');
      }
      if (connection) {
        await connection.close();
        logger.info('User verification consumer connection closed');
      }
      process.exit(0);
    });

  } catch (error) {
    logger.error('Error starting user verification consumer:', error);
    setTimeout(startUserVerificationConsumer, 5000);
  }
}

async function startOrderUpdateConsumer() {
  let connection = null;
  let channel = null;

  const connect = async () => {
    try {
      connection = await amqp.connect(process.env.RABBITMQ_URL, { heartbeat: 60 });
      channel = await connection.createChannel();
      channel.prefetch(10);
      await channel.assertQueue('order-update-request', { durable: true });
      logger.info('Order update consumer initialized');

      connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err);
        channel = null;
        connection = null;
        setTimeout(connect, 5000);
      });

      connection.on('close', () => {
        logger.warn('RabbitMQ connection closed, attempting to reconnect');
        channel = null;
        connection = null;
        setTimeout(connect, 5000);
      });

      return channel;
    } catch (err) {
      logger.error('Failed to initialize RabbitMQ:', err);
      setTimeout(connect, 5000);
      throw err;
    }
  };

  try {
    const channel = await connect();
    const requestQueue = 'order-update-request';

    logger.info('Waiting for order update requests');

    channel.consume(requestQueue, async (msg) => {
      if (msg === null) {
        logger.warn('Received null message');
        return;
      }

      const correlationId = msg.properties.correlationId;
      const replyTo = msg.properties.replyTo;

      try {
        const { userId, order } = JSON.parse(msg.content.toString());
        const { error } = orderUpdateSchema.validate({ userId, order });
        if (error) {
          logger.warn('Invalid message format', { error: error.message, correlationId });
          channel.sendToQueue(
            replyTo,
            Buffer.from(JSON.stringify({ error: 'Invalid message format' })),
            { correlationId }
          );
          channel.ack(msg);
          return;
        }

        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(order.orderId)) {
          logger.warn('Invalid userId or orderId', { userId, orderId: order.orderId, correlationId });
          channel.sendToQueue(
            replyTo,
            Buffer.from(JSON.stringify({ error: 'Valid userId and orderId are required' })),
            { correlationId }
          );
          channel.ack(msg);
          return;
        }

        for (const item of order.items) {
          if (!mongoose.Types.ObjectId.isValid(item.itemId) || item.quantity < 1) {
            logger.warn('Invalid item', { item, correlationId });
            channel.sendToQueue(
              replyTo,
              Buffer.from(JSON.stringify({ error: 'Each item must have a valid itemId and quantity' })),
              { correlationId }
            );
            channel.ack(msg);
            return;
          }
        }

        const user = await async.retry(
          { times: 3, interval: 1000 },
          async () => await userModel.findByIdAndUpdate(
            userId,
            {
              $push: {
                orders: {
                  orderId: order.orderId,
                  items: order.items.map(item => ({
                    itemId: item.itemId,
                    quantity: item.quantity
                  })),
                  status: order.status || 'Processing',
                  Cstatus: order.Cstatus || 'Normal',
                  paymentOption: order.paymentOption || 1,
                  address: order.address || ''
                }
              }
            },
            { new: true }
          )
        );

        let response;
        if (!user) {
          logger.warn('User not found', { userId, correlationId });
          response = { error: 'User not found' };
        } else {
          response = {
            message: 'Order added to user successfully',
            userId: user._id
          };
        }

        logger.info('Sending order update response', { response, correlationId });
        channel.sendToQueue(replyTo, Buffer.from(JSON.stringify(response)), { correlationId });
        channel.ack(msg);
      } catch (error) {
        logger.error('Error processing order update', { error: error.message, correlationId });
        channel.sendToQueue(
          replyTo,
          Buffer.from(JSON.stringify({ error: 'Internal Server Error' })),
          { correlationId }
        );
        channel.ack(msg);
      }
    }, { noAck: false });

    process.on('SIGINT', async () => {
      if (channel) {
        await channel.close();
        logger.info('Order update consumer channel closed');
      }
      if (connection) {
        await connection.close();
        logger.info('Order update consumer connection closed');
      }
      process.exit(0);
    });

  } catch (error) {
    logger.error('Error starting order update consumer:', error);
    setTimeout(startOrderUpdateConsumer, 5000);
  }
}







async function startOrderStatusUpdateConsumer() {
  let connection = null;
  let channel = null;

  const connect = async () => {
    try {
      connection = await amqp.connect(process.env.RABBITMQ_URL, { heartbeat: 60 });
      channel = await connection.createChannel();
      channel.prefetch(10);
      await channel.assertQueue('orderStatus-update-requestx', { durable: true });
      logger.info('Order status update consumer initialized');

      connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err);
        channel = null;
        connection = null;
        setTimeout(connect, 5000);
      });

      connection.on('close', () => {
        logger.warn('RabbitMQ connection closed, attempting to reconnect');
        channel = null;
        connection = null;
        setTimeout(connect, 5000);
      });

      return channel;
    } catch (err) {
      logger.error('Failed to initialize RabbitMQ:', err);
      setTimeout(connect, 5000);
      throw err;
    }
  };

  try {
    const channel = await connect();
    const requestQueue = 'orderStatus-update-requestx';

    logger.info('Waiting for order status update requests');

    channel.consume(requestQueue, async (msg) => {
      console.log(msg,"]]]]]]]]]]]]]]]]]]]]]]]]]")
      if (msg === null) {
        logger.warn('Received null message');
        return;
      }

      const correlationId = msg.properties.correlationId;
      const replyTo = msg.properties.replyTo;

      try {
        const { userId, order } = JSON.parse(msg.content.toString());
        const { error } = orderStatusUpdateSchema.validate({ userId, order });
        console.log(userId,"----------",order)
        if (error) {
          logger.warn('Invalid message format', { error: error.message, correlationId });
          channel.sendToQueue(
            replyTo,
            Buffer.from(JSON.stringify({ success: false, error: 'Invalid message format' })),
            { correlationId }
          );
          channel.ack(msg);
          return;
        }

        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(order.orderId)) {
          logger.warn('Invalid userId or orderId', { userId, orderId: order.orderId, correlationId });
          channel.sendToQueue(
            replyTo,
            Buffer.from(JSON.stringify({ success: false, error: 'Valid userId or orderId required' })),
            { correlationId }
          );
          channel.ack(msg);
          return;
        }
        console.log("reached here------------------")

        const user = await async.retry(
          { times: 3, interval: 1000 },
          async () => await userModel.findOneAndUpdate(
            { _id: userId, 'orders.orderId': order.orderId },
            { $set: { 'orders.$.status': order.status } },
            { new: true }
          )
        );

        let response;
        if (!user) {
          logger.warn('User or order not found', { userId, orderId: order.orderId, correlationId });
          response = { success: false, error: 'User or order not found' };
        } else {
          response = { success: true, message: 'Order status updated in user database' };
        }

        logger.info('Sending order status update response', { response, correlationId });
        channel.sendToQueue(replyTo, Buffer.from(JSON.stringify(response)), { correlationId });
        channel.ack(msg);
      } catch (error) {
        logger.error('Error processing order status update', { error: error.message, correlationId });
        channel.sendToQueue(
          replyTo,
          Buffer.from(JSON.stringify({ success: false, error: 'Internal Server Error' })),
          { correlationId }
        );
        channel.ack(msg);
      }
    }, { noAck: false });

    process.on('SIGINT', async () => {
      if (channel) {
        await channel.close();
        logger.info('Order status update consumer channel closed');
      }
      if (connection) {
        await connection.close();
        logger.info('Order status update consumer connection closed');
      }
      process.exit(0);
    });

  } catch (error) {
    logger.error('Error starting order status update consumer:', error);
    setTimeout(startOrderStatusUpdateConsumer, 5000);
  }
}























async function startOrderCancellationStatusUpdateConsumer() {
  let connection = null;
  let channel = null;

  const connect = async () => {
    try {
      connection = await amqp.connect(process.env.RABBITMQ_URL, { heartbeat: 60 });
      channel = await connection.createChannel();
      channel.prefetch(10);
      await channel.assertQueue('orderCStatus-update-requestx', { durable: true });
      logger.info('Order cancellation status update consumer initialized');

      connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err);
        channel = null;
        connection = null;
        setTimeout(connect, 5000);
      });

      connection.on('close', () => {
        logger.warn('RabbitMQ connection closed, attempting to reconnect');
        channel = null;
        connection = null;
        setTimeout(connect, 5000);
      });

      return channel;
    } catch (err) {
      logger.error('Failed to initialize RabbitMQ:', err);
      setTimeout(connect, 5000);
      throw err;
    }
  };

  try {
    const channel = await connect();
    const requestQueue = 'orderCStatus-update-requestx';

    logger.info('Waiting for order cancellation status update requests');

    channel.consume(requestQueue, async (msg) => {
      if (msg === null) {
        logger.warn('Received null message');
        return;
      }
      console.log(msg,"]]]]]]]]]]]]]]]]]]]]]]]]]")
      const correlationId = msg.properties.correlationId;
      const replyTo = msg.properties.replyTo;

      try {
        const { userId, order } = JSON.parse(msg.content.toString());
        const { error } = orderCancelStatusUpdateSchema.validate({ userId, order });
        
        console.log(userId,"----------",order)
        if (error) {
          logger.warn('Invalid message format', { error: error.message, correlationId });
          channel.sendToQueue(
            replyTo,
            Buffer.from(JSON.stringify({ success: false, error: 'Invalid message format' })),
            { correlationId }
          );
          channel.ack(msg);
          return;
        }

        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(order.orderId)) {
          logger.warn('Invalid userId or orderId', { userId, orderId: order.orderId, correlationId });
          channel.sendToQueue(
            replyTo,
            Buffer.from(JSON.stringify({ success: false, error: 'Valid userId or orderId required' })),
            { correlationId }
          );
          channel.ack(msg);
          return;
        }

        const cancleOrderStatusNumberMap = {
          Normal: 0,
          'Cancellation Requested': 1,
          'Cancelled by Admin': 2
        };

        const user = await async.retry(
          { times: 3, interval: 1000 },
          async () => await userModel.findOneAndUpdate(
            { _id: userId, 'orders.orderId': order.orderId },
            { $set: { 'orders.$.Cstatus': cancleOrderStatusNumberMap[order.Cstatus] } },
            { new: true }
          )
        );

        let response;
        if (!user) {
          logger.warn('User or order not found', { userId, orderId: order.orderId, correlationId });
          response = { success: false, error: 'User or order not found' };
        } else {
          response = { success: true, message: 'Order cancellation status updated in user database' };
        }

        logger.info('Sending order cancellation status update response', { response, correlationId });
        channel.sendToQueue(replyTo, Buffer.from(JSON.stringify(response)), { correlationId });
        channel.ack(msg);
      } catch (error) {
        logger.error('Error processing order cancellation status update', { error: error.message, correlationId });
        channel.sendToQueue(
          replyTo,
          Buffer.from(JSON.stringify({ success: false, error: 'Internal Server Error' })),
          { correlationId }
        );
        channel.ack(msg);
      }
    }, { noAck: false });

    process.on('SIGINT', async () => {
      if (channel) {
        await channel.close();
        logger.info('Order cancellation status update consumer channel closed');
      }
      if (connection) {
        await connection.close();
        logger.info('Order cancellation status update consumer connection closed');
      }
      process.exit(0);
    });

  } catch (error) {
    logger.error('Error starting order cancellation status update consumer:', error);
    setTimeout(startOrderCancellationStatusUpdateConsumer, 5000);
  }
}
























async function startOrderDeletionConsumer() {
  let connection = null;
  let channel = null;

  const connect = async () => {
    try {
      connection = await amqp.connect(process.env.RABBITMQ_URL, { heartbeat: 60 });
      channel = await connection.createChannel();
      channel.prefetch(10);
      await channel.assertQueue('order-delete-request', { durable: true });
      logger.info('Order deletion consumer initialized');

      connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err);
        channel = null;
        connection = null;
        setTimeout(connect, 5000);
      });

      connection.on('close', () => {
        logger.warn('RabbitMQ connection closed, attempting to reconnect');
        channel = null;
        connection = null;
        setTimeout(connect, 5000);
      });

      return channel;
    } catch (err) {
      logger.error('Failed to initialize RabbitMQ:', err);
      setTimeout(connect, 5000);
      throw err;
    }
  };

  try {
    const channel = await connect();
    const requestQueue = 'order-delete-request';

    logger.info('Waiting for order deletion requests');

    channel.consume(requestQueue, async (msg) => {
      if (msg === null) {
        logger.warn('Received null message');
        return;
      }

      const correlationId = msg.properties.correlationId;
      const replyTo = msg.properties.replyTo;

      try {
        const { userId, orderId } = JSON.parse(msg.content.toString());
        const { error } = orderDeleteSchema.validate({ userId, orderId });
        if (error) {
          logger.warn('Invalid message format', { error: error.message, correlationId });
          channel.sendToQueue(
            replyTo,
            Buffer.from(JSON.stringify({ error: 'Invalid message format' })),
            { correlationId }
          );
          channel.ack(msg);
          return;
        }

        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(orderId)) {
          logger.warn('Invalid userId or orderId', { userId, orderId, correlationId });
          channel.sendToQueue(
            replyTo,
            Buffer.from(JSON.stringify({ error: 'Valid userId and orderId are required' })),
            { correlationId }
          );
          channel.ack(msg);
          return;
        }

        const user = await async.retry(
          { times: 3, interval: 1000 },
          async () => await userModel.findOneAndUpdate(
            { _id: userId, 'orders.orderId': orderId },
            { $pull: { orders: { orderId } } },
            { new: true }
          )
        );

        let response;
        if (!user) {
          logger.warn('User or order not found', { userId, orderId, correlationId });
          response = { error: 'User or order not found' };
        } else {
          response = {
            message: 'Order deleted from user successfully',
            userId,
            orderId
          };
        }

        logger.info('Sending order deletion response', { response, correlationId });
        channel.sendToQueue(replyTo, Buffer.from(JSON.stringify(response)), { correlationId });
        channel.ack(msg);
      } catch (error) {
        logger.error('Error processing order deletion', { error: error.message, correlationId });
        channel.sendToQueue(
          replyTo,
          Buffer.from(JSON.stringify({ error: 'Internal Server Error' })),
          { correlationId }
        );
        channel.ack(msg);
      }
    }, { noAck: false });

    process.on('SIGINT', async () => {
      if (channel) {
        await channel.close();
        logger.info('Order deletion consumer channel closed');
      }
      if (connection) {
        await connection.close();
        logger.info('Order deletion consumer connection closed');
      }
      process.exit(0);
    });

  } catch (error) {
    logger.error('Error starting order deletion consumer:', error);
    setTimeout(startOrderDeletionConsumer, 5000);
  }
}

startUserVerificationConsumer();
startOrderUpdateConsumer();
startOrderStatusUpdateConsumer();
startOrderCancellationStatusUpdateConsumer();
startOrderDeletionConsumer();