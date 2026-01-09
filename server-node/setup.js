const pool = require('./db');

const createTableQuery = `
    CREATE TABLE IF NOT EXISTS interviwes(
    id SERIAL PRIMARY KEY,
    json_log JSONB NOT NULL,
    session_id text,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

const setup = async() => {
    try{
        await pool.query(createTableQuery);
        console.log("Table INTERVIEW created successfully!");
        process.exit();
    }catch(error){
        console.error("Error creating INTERVIEW table:",error);
        process.exit(1);
    }
};

setup();