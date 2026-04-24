const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI;
    
    // If no external MongoDB is available, use in-memory server for development
    if (process.env.NODE_ENV !== 'production') {
      try {
        // Try connecting to the configured URI first
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
        console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
        return;
      } catch (err) {
        console.log('⚠️  External MongoDB not available, starting in-memory server...');
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        uri = mongod.getUri();
        
        // Store reference to stop on process exit
        process.on('SIGINT', async () => {
          await mongod.stop();
          process.exit(0);
        });
      }
    }
    
    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
