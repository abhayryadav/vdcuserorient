const userModel = require('../models/user.models')

module.exports.createUser =  async({ firstname, lastname, email, password, profileImageLink, phoneNumber})=>{
    if( ! firstname || ! lastname || ! email || ! password || ! phoneNumber){
        throw new Error('all fields are required')
    }
    const user = userModel.create({
        fullname:{
            firstname,
            lastname
        },
        email,
        password,
        profileImageLink,
        phoneNumber, 
    })
    return user;
}