const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const viewRouter = require('./routes/viewRoutes');

const app = express();

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
//-- GlOBAL MIDDLEWARES-----

// serving static files
app.use(express.static(path.join(__dirname, 'public')));

//Set security HTTP headers
app.use(helmet({
    contentSecurityPolicy: false
})
);

// console.log(process.env.NODE_ENV);

//Developement logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

//limit requests from same API
const limiter = rateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000,
    message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter);


//Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));//middleware for post request(necessary)
app.use(express.urlencoded({
    extended: true,
    limit: '10kb'
}));
app.use(cookieParser());


//Data sanitization against NoSQL query injection
app.use(mongoSanitize());


//Data sanitization against XSS (cross-site-scripting)
app.use(xss());

//prevent parameter pollution
app.use(hpp({
    whitelist: [
        'duration',
        'ratingsAverage',
        'ratingsQuantity',
        'maxGroupSize',
        'difficulty',
        'price'
    ]
}));




//Test middleware
app.use((req, res, next) => {
    //req.requestTime = new Date().toISOString();
    // console.log(req.cookies);
    next();

});
//--ROUTE HANDLERS

// app.get('/api/v1/tours', getAllTour)
// app.post('/api/v1/tours', createTour);
// //for one tour---
// app.get('/api/v1/tours/:t_id', getTour);
// app.patch('/api/v1/tours/:t_id', updateTour);
// app.delete('/api/v1/tours/:t_id', deleteTour);

//--ROUTES

app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);




//IF NO ROUTES GOT MATCHED( matlab agar kisine galat url daala tab )
//should be at the end of all the routes
app.all('*', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} in this server!`, 404));
});

app.use(globalErrorHandler);

//--START SERVER
module.exports = app;