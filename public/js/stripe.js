import axios from 'axios';
import { showAlert } from './alerts';
const stripe = Stripe('pk_test_51HUUJjKBiwuz4Dv0kAPgz5c2m7NY3BTiYQpeDBuCPRXcSS0beEF4Lchl6fim5GW9W5dOF6tY9TBTRQQk3ufZpgeW00D5QI14ZF');

export const bookTour = async tourId => {
    try {
        //1) Get checkout session from API
        const session = await axios(`http://127.0.0.1:3000/api/v1/bookings/checkout-session/${tourId}`);



        //2)Create checkout from + charge credit card
        await stripe.redirectToCheckout({
            sessionId: session.data.session.id
        })

    } catch (err) {
        console.log(err);
        showAlert('error', err);
    }

}