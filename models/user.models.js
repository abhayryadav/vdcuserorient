const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt')
const userSchema = new mongoose.Schema({
    fullname:{
        firstname:{
            type : String,
            require : true,
            minlength :[3,'first name must be at least of 3 characters']
        },
        lastname:{
            type : String,
            require : true,
            minlength :[3,'last name must be at least of 3 characters']
        }
    },
    age:{
        type : String,
        require : true
    },
    email:{
        type : String,
        require : true,
        unique: true
    },
    password:{
        type : String,
        require : true,
        select: false
    },
    phoneNumber:{
        type : Number,
        require : true,
    },
    profileImageLink:{
        type : String,
        unique: false,
    },
    wishlist: [
        {
            itemId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Item',
                required: true
            }
        }
    ],
    cart: [
        {
            itemId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Item',
                required: true
            },
            quantity: {
                type: Number,
                default: 1,
                min: [1, 'Quantity must be at least 1']
            }
        }
    ],
    orders: [
        {
            itemId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Item',
                required: true
            },
            quantity: {
                type: Number,
                default: 1,
                min: [1, 'Quantity must be at least 1']
            },
            status: {
                type: String,
                default:'Order Placed'
            },
            paymentOption: {
                type: Number,
            },
            address: {
                type: String,
            }
        }
    ]
})
userSchema.methods.generateAuthTken = function() {
    const token = jwt.sign(
        { 
            _id: this._id, 
            fullname: this.fullname, 
            email: this.email 
        },
        process.env.JWT_SECRET_KEY,
        { expiresIn: '1h' } // Optional: Set token expiration
    );
    return token;
};

userSchema.methods.comparePassword = async function(password){
    return await bcrypt.compare(password,this.password)
}
userSchema.statics.hashPassword = async function(password){
    return await bcrypt.hash(password,10)
}

const userModel = mongoose.model('User',userSchema)
module.exports = userModel