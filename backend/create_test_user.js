const mongoose = require('mongoose');
const User = require('./src/models/User'); 

require('dotenv').config();

const fixTestUser = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        // delete the corrupted user
        await User.deleteOne({ phone: '0911223344' });

        // recreate properly (User model pre-save hook handles hashing!)
        const user = new User({
            username: 'Test User',
            phone: '0911223344',
            password: '123456'
        });

        await user.save();
        console.log('Test user fixed! Password is now properly 123456.');
        process.exit(0);
    } catch (err) {
        console.error('Error fixing user', err);
        process.exit(1);
    }
};

fixTestUser();
