const crypto = require('crypto');
const { promisify } = require('util');// util module me se sirf promisify le rahe hain
const jwt = require('jsonwebtoken');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');



const signToken = (id) => {
    return jwt.sign({ id: id }, process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN });
}

const createSendToken = (user, statusCode, res) => {
    const token = signToken(user._id);
    const cookieOptions = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
        httpOnly: true
    }
    if (process.env.NODE_ENV === 'production') {
        cookieOptions.secure = true; //cookie will only work on https not on http
    }
    res.cookie('jwt', token, cookieOptions);

    //Remove password from output
    user.password = undefined;

    res.status(statusCode).json({
        status: 'success',
        token: token,
        data: {
            user: user
        }
    });
}

exports.signup = catchAsync(async (req, res, next) => {

    const newUser = await User.create({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        passwordConfirm: req.body.passwordConfirm
    });
    const url = `${req.protocol}://${req.get('host')}/me`;

    await new Email(newUser, url).sendWelcome();
    createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {

    // const email = req.body.email;
    // const password = req.body.password;
    //upar ki 2 lines k baraabar neeche ki ek line
    const { email, password } = req.body;

    //1)Check if email and password exist
    if (!email || !password) {
        return next(new AppError('Please provide email and password', 400));
    }

    //2)Check if user exist and password is correct
    const user = await User.findOne({ email: email }).select('+password');


    if (!user || !(await user.correctPass(password, user.password))) {
        return next(new AppError('Incorrect email or password!', 401));
    }

    //3)If everything is Ok, send token to client
    createSendToken(user, 200, res);
});

exports.logout = (req, res) => {
    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });
    res.status(200).json({
        status: 'success'
    });
}

exports.protect = catchAsync(async (req, res, next) => {
    //1) Getting token and check if its there
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
        token = req.cookies.jwt;
    }

    if (!token) {
        return next(new AppError('You are not logged in! Please login to get access.', 401));
    }

    //2) Verification Token

    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    //3) Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
        return next(new AppError
            ('The User belonging to this token does no longer exist', 401));
    }

    //4)check if user changed password after token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next(new AppError('User recently changed password! Please login again.', 401));
    }

    //Grant Access to protected route
    req.user = currentUser;
    res.locals.user = currentUser;
    next();
});

//Only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
    if (req.cookies.jwt) {
        try {
            //1)Verify a token
            const decoded = await promisify(jwt.verify)(req.cookies.jwt, process.env.JWT_SECRET);

            //2) Check if user still exists
            const currentUser = await User.findById(decoded.id);
            if (!currentUser) {
                return next();
            }

            //3)check if user changed password after token was issued
            if (currentUser.changedPasswordAfter(decoded.iat)) {
                return next();
            }

            //THERE IS LOGGED IN USER
            res.locals.user = currentUser; // Iski madad se 'user' variable ko template me use kar sakte hain
            return next();
        } catch (err) {
            return next();
        }
    }
    next();
};



exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        //roles ['admin','lead-guide']
        if (!roles.includes(req.user.role)) {
            return next(new AppError('You do not have permission to perform this action', 403));
        }
        next();
    }
}

exports.forgotPassword = catchAsync(async (req, res, next) => {
    //1) Get user based on posted email
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
        return next(new AppError('There is no user with that email address!', 404));
    }


    //2)Generate a random reset token

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });


    //3)Send it to user's email
    try {
        const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;
        await new Email(user, resetURL).sendPasswordReset();

        res.status(200).json({
            status: 'success',
            message: 'Token sent to email!'
        });
    } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });

        return next(new AppError('There was an error sending the email. Try again later!', 500));
    }


});

exports.resetPassword = catchAsync(async (req, res, next) => {
    //1)Get user based on token
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
    });

    //2)If the token has not expired, and there is user , set the new password
    if (!user) {
        return next(new AppError('Token is invalid or has expired', 400));
    }
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    //3)Update passwordChangedAt property for the user
    //usermodel me likha hai..userSchema.pre(''save)

    //4)Log the user in
    createSendToken(user, 200, res);

});

exports.updatePassword = catchAsync(async (req, res, next) => {
    //1)Get the user from collection
    const user = await User.findById(req.user.id).select('+password');

    //2)check if Posted current password is correct
    if (!(await user.correctPass(req.body.passwordCurrent, user.password))) {
        return next(new AppError('Your current password is wrong!', 401));
    }

    //3)If so, update password
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();

    //4)log user in , send JWT
    createSendToken(user, 200, res);


});