const mysql = require('mysql2');
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'deneme1',
};
const connection = mysql.createConnection(dbConfig);

connection.connect((err) => {
    if (err) {
        console.error('MySQL connection error:', err);
    } else {
        console.log('Connected to MySQL database');
    }
});

module.exports = connection;
