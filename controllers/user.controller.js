const userModel = require('../models/user.models')
const userService = require('../userService/user.service')
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt')
const { validationResult } = require('express-validator')
const amqp = require('amqplib');

const Stripe = require('stripe');
const dotenv = require('dotenv');
dotenv.config();
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);








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
module.exports.ShowCart = async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Authorization token is required' });
      }
  
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      const email = decoded.email;
  
      const user = await userModel.findOne({ email });
  
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      const itemIds = user.cart.map((item) => item.itemId);
  
      // Connect to RabbitMQ and send a message to the 'item-request' queue
      const connection = await amqp.connect('amqps://spogxdre:xsftHXmfeGSJlWsfCYVAnF1g6AXSlmuI@kebnekaise.lmq.cloudamqp.com/spogxdre', {
        heartbeat: 60
      });
      const channel = await connection.createChannel();
      console.log("Connected to RabbitMQ-----",channel);
      const requestQueue = 'item-request';
      const replyQueue = 'item-response'; // Response queue for the item details
  
      await channel.assertQueue(requestQueue, { durable: true });
      await channel.assertQueue(replyQueue, { durable: true });
  
      // Send itemIds as the message to the 'item-request' queue, and specify the reply-to queue
      const correlationId = generateUuid(); // Create a unique correlation ID for tracking

      const cartItems = user.cart.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity // Use the actual quantity from the user's cart
      }));


      console.log({ cartItems, userId: user._id },"==============================================")
      channel.sendToQueue(requestQueue, Buffer.from(JSON.stringify({ cartItems, userId: user._id })),
        {
          persistent: true,
          replyTo: replyQueue,  // Specify where to send the response
          correlationId: correlationId  // Used for matching request and response
        });
  
      console.log("Sent item request message to queue:", { cartItems, userId: user._id });
        console.log("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
      // Listen for the response from the Item Service
      channel.consume(replyQueue, (msg) => {
        console.log("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
        if (msg.properties.correlationId === correlationId) {
          const cartWithDetails = JSON.parse(msg.content.toString());
          console.log("Received item response message from queue:", cartWithDetails);
          console.log("cccccccccccccccccccccccccccccccccccccc")
          res.status(200).json({
            message: 'Cart retrieved successfully',
            cart: cartWithDetails
          });
          channel.close();
          connection.close();
        }
      }, { noAck: true });
  
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to retrieve cart' });
    }
  };
  
//   // Generate a unique correlation ID for each request
//   function generateUuid() {
//     return (Math.floor(Math.random() * 1e6)).toString(); // Ensure it's a string
//   }
  





// module.exports.ShowWishlist = async (req, res) => {
//     try {
//         const authHeader = req.headers.authorization;
//         if (!authHeader) {
//             return res.status(401).json({ error: 'Authorization token is required' });
//         }

//         const token = authHeader.split(' ')[1];
//         const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
//         const email = decoded.email;

//         const user = await userModel.findOne({ email }).populate('wishlist.itemId', 'name description price availableQuantity'); // Adjust fields as per your `Item` model

//         if (!user) {
//             return res.status(404).json({ error: 'User not found' });
//         }

//         res.status(200).json({ message: 'Wishlist retrieved successfully', wishlist: user.wishlist });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Failed to retrieve wishlist' });
//     }
// };



module.exports.ShowWishlist = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization token is required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const email = decoded.email;

        const user = await userModel.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const wishlistItems = user.wishlist.map(item => ({
            itemId: item.itemId,
        }));

        // Connect to RabbitMQ
        const connection = await amqp.connect('amqps://spogxdre:xsftHXmfeGSJlWsfCYVAnF1g6AXSlmuI@kebnekaise.lmq.cloudamqp.com/spogxdre', {
            heartbeat: 60
          });
        const channel = await connection.createChannel();
        console.log("Connected to RabbitMQ   [][][][][][][][][][][][][][][][][][]",channel);
        const requestQueue = 'item-request-wishlist';
        const replyQueue = 'item-response-wishlist';

        await channel.assertQueue(requestQueue, { durable: true });
        await channel.assertQueue(replyQueue, { durable: true });

        const correlationId = generateUuid();
        console.log({ wishlistItems, userId: user._id },"==============================================")
        // Send wishlist items to the Item Service
        channel.sendToQueue(
            requestQueue,
            Buffer.from(JSON.stringify({ wishlistItems, userId: user._id })),
            {
                persistent: true,
                replyTo: replyQueue,
                correlationId: correlationId
            }
        );

        console.log("Sent wishlist request to queue:", { wishlistItems, userId: user._id });

        // Listen for the response from the Item Service
        channel.consume(replyQueue, (msg) => {
            if (msg.properties.correlationId === correlationId) {
                const wishlistWithDetails = JSON.parse(msg.content.toString());
                console.log("Received wishlist response from queue:", wishlistWithDetails);

                res.status(200).json({
                    message: 'Wishlist retrieved successfully',
                    wishlist: wishlistWithDetails
                });

                channel.close();
                connection.close();
            }
        }, { noAck: true });

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

///////////////////////////////////////
// module.exports.Checkout = async (req, res) => {
//     try {
//         const { cartItems } = req.body; // Get cart items from request body

//         if (!cartItems || cartItems.length === 0) {
//             return res.status(400).json({ error: "Cart is empty" });
//         }

//         const lineItems = cartItems.map(item => ({
//             price_data: {
//                 currency: 'usd',
//                 product_data: {
//                     name: item.itemDetail.productName,
//                     images: [item.itemDetail.imageLink],
//                 },
//                 unit_amount: item.itemDetail.price * 100, // Convert dollars to cents
//             },
//             quantity: item.quantity,
//         }));

//         // Create a Stripe Checkout session
//         const session = await stripe.checkout.sessions.create({
//             payment_method_types: ['card'],
//             line_items: lineItems,
//             mode: 'payment',
//             success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
//             cancel_url: `${process.env.FRONTEND_URL}/cart`,
//         });

//         res.json({ url: session.url }); // Send checkout URL back to client
//     } catch (error) {
//         console.error("Error creating Stripe session:", error);
//         res.status(500).json({ error: "Failed to create checkout session" });
//     }
// };

