const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/keys');
const requireLogin = require('../middleware/requireLogin');
const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');
const { SENDGRID_API, EMAIL } = require('../config/keys');

// router.get('/protected', requireLogin, (req, res) => {
//   res.json({ message: 'hello User' });
// });

// SEND GRID MAILER KEY

const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key: SENDGRID_API,
    },
  })
);

//FOR SIGNUP
router.post('/signup', (req, res) => {
  // console.log(req.body.name);
  const { name, email, password, pic } = req.body;
  if (!email || !password || !name) {
    return res.status(422).json({ error: 'Please fill all the fields' });
  }
  User.findOne({ email: email }).then((savedUser) => {
    if (savedUser) {
      return res.status(422).json({ message: 'User already exists !' });
    }
    bcrypt
      .hash(password, 15)
      .then((hashedpassword) => {
        const user = new User({
          email,
          password: hashedpassword,
          name,
          pic,
        });
        user
          .save()
          .then((user) => {
            transporter
              .sendMail({
                to: user.email,
                from: 'mathanganjeya@outlook.com',
                subject: 'Instagramsl Signup success',
                html:
                  '<h1>welcome to <br>instagramsl !!</h1><p>This is only build for edu purpose</p>',
              })
              .catch((err) => {
                console.log(err);
              });

            res.json({ message: 'User saved sucessfully' });
          })
          .catch((err) => {
            console.log(err);
          });
      })
      .catch((err) => {
        console.log(err);
      });
  });

  // res.json({ message: 'Sucessfully posted' });
});

//FOR SIGNIN
router.post('/signin', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(422).json({ error: 'please provie email and password' });
  }
  User.findOne({ email }).then((savedUser) => {
    if (!savedUser) {
      res.status(422).json({ error: 'Invalid email or password' });
    }
    bcrypt
      .compare(password, savedUser.password)
      .then((doMatch) => {
        if (doMatch) {
          // res.json({ message: 'Sucessfully signed in' });
          const token = jwt.sign({ _id: savedUser._id }, JWT_SECRET);
          const { _id, name, email, followers, following, pic } = savedUser;
          res.json({
            token,
            user: { _id, name, email, followers, following, pic },
          });
        } else {
          return res.status(422).json({ error: 'Invalid email or password' });
        }
      })
      .catch((err) => {
        console.log(err);
      });
  });
});

// FOR RESET PASSWORD here
router.post('/reset-password', (req, res) => {
  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.log(err);
    }
    const token = buffer.toString('hex');
    User.findOne({ email: req.body.email }).then((user) => {
      if (!user) {
        return res
          .status(422)
          .json({ error: 'User does not exist with this email' });
      }
      user.resetToken = token;
      user.expireToken = Date.now() + 3600000;
      user.save().then((result) => {
        transporter
          .sendMail({
            to: user.email,
            from: 'mathanganjeya@outlook.com',
            subject: 'Password Reset Process',
            html: `
            <p>You requested for password reset</p>
            <h5>click in this <a href="${EMAIL}/reset/${token}">link</a> to reset password</h5>
            `,
          })
          .catch((err) => {
            console.log(err);
          });
        res.json({ message: 'Email sent ...Please check your email !' });
      });
    });
  });
});

// FOR New PASSWORD POST
router.post('/new-password', (req, res) => {
  const newPassword = req.body.password;
  const sentToken = req.body.token;
  User.findOne({
    resetToken: sentToken,
    expireToken: {
      $gt: Date.now(),
    },
  })
    .then((user) => {
      if (!user) {
        return res.status(422).json({ error: 'Tyragain session expired' });
      }
      bcrypt.hash(newPassword, 12).then((hashedpassword) => {
        user.password = hashedpassword;
        user.resetToken = undefined;
        user.expireToken = undefined;
        user.save().then((saveduser) => {
          res.json({ message: 'PAsswordUpdate Succesfully !' });
        });
      });
    })
    .catch((err) => {
      console.log(err);
    });
});

module.exports = router;
