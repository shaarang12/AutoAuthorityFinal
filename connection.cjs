const mysql = require("mysql")
const con = mysql.createConnection({

    host: "autoauthority.cikjgc7xrldu.ap-south-1.rds.amazonaws.com",
    user: "admin",
    password: "adminadmin",
    database: "AutoAuthority",
    port: 3306
});

con.connect((err) => {
    if (err) throw err;
    console.log("Connection created..!!");
});

module.exports.con = con;