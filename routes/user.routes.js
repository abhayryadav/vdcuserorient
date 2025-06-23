const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { body } = require("express-validator");
const {verifyToken} = require("../tokenVerificationService/tokenVerification.service");

router.post(
  "/verifyme",
  verifyToken, // Token verification middleware
  userController.verifyme
);

router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Invalid Email"),
    body("fullname.firstname")
      .isLength({ min: 3 })
      .withMessage("First name must be at least 3 characters"),
    body("fullname.lastname")
      .isLength({ min: 3 })
      .withMessage("Last name must be at least 3 characters"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  userController.registerUser
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Invalid Email")
  ],
  userController.login
);

router.post(
  "/updateProfileImage",
  verifyToken,
  userController.updateProfileImage
);

router.post(
  "/deleteProfileImage",
  verifyToken,
  userController.deleteProfileImage
);

router.delete(
  "/delete",
  [
    verifyToken,
    // Validate the authorization token in headers
    body("authorization").custom((_, { req }) => {
      if (!req.headers.authorization) {
        throw new Error("Authorization token is required");
      }
      return true;
    }),

    // Validate password
    body("password").exists().withMessage("Password is required"),
  ],
  userController.deleteUser
);

// Add item to the cart
router.post(
  "/AddItemToCart",
  verifyToken, // Token verification middleware
  userController.AddItemToCart
);

// Add item to the cart
router.post(
  "/UpdateItemQuantityInCart",
  verifyToken, // Token verification middleware
  userController.UpdateItemQuantityInCart
);

// Add item to the wishlist
router.post(
  "/ToggleWishlistItem",
  verifyToken, // Token verification middleware
  userController.ToggleWishlistItem
);

//MoveItemToWishlist
router.post(
  "/MoveItemToWishlist",
  verifyToken, // Token verification middleware
  userController.MoveItemToWishlist
);

// Remove item from the cart
router.delete(
  "/RemoveItemFromCart",
  verifyToken, // Token verification middleware
  userController.RemoveItemFromCart
);

// Remove item from the wishlist
router.post(
  "/RemoveItemFromWishlist",
  verifyToken, // Token verification middleware
  userController.RemoveItemFromWishlist
);

// Show cart
router.get(
  "/ShowCart",
  verifyToken, // Token verification middleware
  userController.ShowCart
);

// Show wishlist
router.get(
  "/ShowWishlist",
  verifyToken, // Token verification middleware
  userController.ShowWishlist
);

// MoveItemToCart
router.post(
  "/MoveItemToCart",
  verifyToken, // Token verification middleware
  userController.MoveItemToCart
);

// checkout
router.post(
  "/Checkout",
  verifyToken, // Token verification middleware
  userController.MoveItemToCart
);


// getWishlistItemCount
router.post(
  "/getWishlistItemCount",
  verifyToken, // Token verification middleware
  userController.getWishlistItemCount
);




router.get(
    "/getUserOrders",
    verifyToken, // Token verification middleware
    userController.getUserOrders
  );


// getCartItemCount
router.post(
  "/getCartItemCount",
  verifyToken, // Token verification middleware
  userController.getCartItemCount
);

module.exports = router;
