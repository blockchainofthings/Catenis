/**
 * Created by claudio on 2020-07-20
 */

export const LoginChallenge = Object.freeze({
    type: Object.freeze({
        reCaptcha: 'reCaptcha',     // Google reCAPTCHA
        twoFAuth: 'twoFAuth'        // Two-factor authentication
    })
});