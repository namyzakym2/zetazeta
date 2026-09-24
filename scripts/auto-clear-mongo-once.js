'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// The marker lives outside MongoDB so it survives the database wipe.
// Once this file exists, the automatic wipe is skipped forever for this install.
const markerPath = path.join(__dirname, '..', '.mongo-cleared-once');

async function main() {
  if (fs.existsSync(markerPath)) {
    console.log('🛡️ MongoDB one-time cleanup already completed. Skipping wipe.');
    return;
  }

  if (!process.env.MONGODB_URI) {
    console.error('❌ Missing MONGODB_URI in .env — automatic MongoDB cleanup was NOT performed.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const dbName = mongoose.connection.db.databaseName;
    console.log(`🗄️ Connected to MongoDB database: ${dbName}`);
    console.log('🧹 First-run cleanup: dropping the entire MongoDB database...');

    await mongoose.connection.dropDatabase();

    // Write the marker only AFTER the database was successfully dropped.
    fs.writeFileSync(
      markerPath,
      `ZETA MongoDB one-time cleanup completed at ${new Date().toISOString()}\nDatabase: ${dbName}\n`,
      'utf8'
    );

    console.log(`✅ MongoDB database "${dbName}" was completely cleared.`);
    console.log('🔒 One-time cleanup marker created. Future starts will NOT wipe MongoDB again.');
  } catch (error) {
    console.error('❌ Automatic MongoDB cleanup failed:', error?.message || error);
    console.error('⛔ The one-time marker was NOT created, so the next start will retry the cleanup.');
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

main();
