import { openDatabase } from "../server/db.js";
import { processOutbox } from "../server/mailer.js";
const db = openDatabase();
console.log("Outbox messages processed:", await processOutbox(db));
db.close();
