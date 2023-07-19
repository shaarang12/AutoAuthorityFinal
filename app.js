// imports
import express from 'express'
import bcrypt from 'bcrypt'
import mysql from 'mysql'
import session from 'express-session'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'

//creating an express application
const app = express()

//one day
const oneDay = 1000 * 60 * 60 * 24

//using express session
app.use(session({
    secret: "thisismysecrctekeyfhrgfgrfrty84fwir767",
    saveUninitialized:true,
    cookie: { maxAge: oneDay },
    resave: false 
}))

app.use(cookieParser())

app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())

//creating mysql connection pool
const pool = mysql.createPool({
    connectionLimit: 10,
    host: 'autoauthority.cikjgc7xrldu.ap-south-1.rds.amazonaws.com',
    user: 'admin',
    password: 'adminadmin',
    database: 'AutoAuthority',
})

//setting default engine to handlebar
app.set('view engine', 'hbs')

//parse request bodies as json
app.use(express.json())

//static files from the public directory
app.use(express.static('public'))

//rendering the main index page
app.get('/', (req, res)=>{
    res.render('index');
})

//rendering the fines page
app.get('/fine', (req, res)=>{
    res.render('fines')
})

//route for signup page
app.get('/register', (req, res)=>{
    res.render('register1')
})

//route for vehicle owner login page
app.get('/login', (req, res)=>{
    res.render('login1')
})

//route for rto officer login page
app.get('/rto_login', (req, res)=>{
    res.render('rto_login')
})

//route for rto officer dashboard
app.get('/rto_index', (req, res)=>{
    res.render('rto_index', {msg: true})
})

//route for vehicle owner to fetch list of his vehicles
app.get('/vehicles', async(req, res) =>{
    if(req.session.loggedin){
      try{
        pool.query('SELECT reg_plate, company, model, color FROM user_vehicle WHERE user_id = ?', [req.session.user], function(err, results){
          if (err) throw err;
          // Render the vehicles view with the results
          res.render('vehicles', {vehicles: results});
        })
      }
      catch(error){
        res.status(500).send(error.message)
      }
    }
    else{
      res.redirect('/')
    }
})

//route for vehicle owner to fetch all of his pending fines.
app.get('/view_fines', async(req, res)=>{
    if(req.session.loggedin){
      try{
        pool.query('SELECT i.doi, uv.reg_plate, f.offence, f.fine_amount, DATE_FORMAT(i.doi, "%a %b %e %Y %T") AS formatted_doi FROM fines f JOIN impose_fine i ON f.fine_id = i.fine_id JOIN user_vehicle uv ON uv.reg_plate = i.veh_reg_no JOIN user_register ur ON ur.user_id = uv.user_id WHERE ur.user_id = ?', [req.session.user], function(err, result){
          if(err) throw err;
          // Calculate total fine
          let total_fine = 0;
          for(let i = 0; i < result.length; i++) {
            total_fine += result[i].fine_amount
          }
          res.render('view_fines', { fine: result, total_fine: total_fine })
        })      
      }
      catch(error){
        res.status(500).send(error.message)
      }
    }
    else{
      res.redirect('/');
    }
})

//variables required for route
var data1, data3
var noOfDays
var displayMarquee = false
var expired = false

//variables for register page 1
var f_name, l_name, dob, age, gender, formattedDate

//route for first register page
app.post('/register1', async(req, res)=>{
    f_name = req.body.fname
    l_name = req.body.lname
    dob = req.body.dob
    gender = req.body.gender

    //calculating age from dob
    var temp_date = new Date(dob)
    formattedDate = [temp_date.getDate(), temp_date.getMonth() + 1, temp_date.getFullYear()].join('/')
    const dobParts = formattedDate.split('/')
    const dobDay = parseInt(dobParts[0], 10)
    const dobMonth = parseInt(dobParts[1], 10) - 1
    const dobYear = parseInt(dobParts[2], 10)
    const dobDate = new Date(dobYear, dobMonth, dobDay)

    //calculating age in years
    const ageDiffs = Date.now() - dobDate.getTime()
    const ageDate = new Date(ageDiffs)
    age = Math.abs(ageDate.getUTCFullYear() - 1970)
    console.log(age)
    if(age < 18)
        res.render('register', {msg: true})
    else    
        res.render('register2')
})

//variables for register page 2
var phone, email, address_p, address_s

//route for second register page
app.post('/register2', async(req, res)=>{
    phone = req.body.phone
    email = req.body.email
    address_p = req.body.address_p
    address_s = req.body.address_s
    res.render('register3')
})

//variables for register page 3
var user_id, password, c_password, hash

//route for third register page
app.post('/register3', async(req, res)=>{
    user_id = req.body.userid
    password = req.body.password
    c_password = req.body.cpassword

    //password validation
    if(password === c_password){
        hash = await bcrypt.hash(password, 12)
        pool.query('INSERT INTO user_register (f_name, l_name, dob, age, gender, phone, email, address_p, address_s, user_id, user_pass) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [f_name, l_name, dob, age, gender, phone, email, address_p, address_s, user_id, hash], (err)=>{
            if(err)
                console.log('Failed to Create User: ', err)
            else{
                console.log('User Created Successfully!')
                res.redirect('/')
            }
        })
    }
    else{
        console.log('Passwords Do Not Match!')
        res.render('register', {msg: true})
        return false
    }
})

//route for rto officer to impose fines on vehicle
app.post('/fine', async(req, res)=>{
    if(req.session.loggedin){
        const vehicle = req.body.regno;
        const fine = req.body.fineid;
        const doi = req.body.doi;

        //querying the db
        pool.query('INSERT INTO impose_fine (veh_reg_no, fine_id, doi) VALUES (?,?,?)', [vehicle, fine, doi], (err)=>{
            if(err)
                console.log('Failed to Add Fine: ', err)
            else{
                console.log('Fine Added Successfully')
                res.redirect('rto_index')
            }
        })
    }
    else
        res.redirect('/')
})

//login route for rto officer
app.post('/rto_login', async(req, res)=>{
    const rto_id = req.body.username
    const rto_pass = req.body.password

    //querying the db
    pool.query('SELECT rto_pass FROM rto_login WHERE rto_id = ?', [rto_id], async(err, result)=>{
        if(err)
            console.log('Error While Retrieving Data!')
        else{
            if(result.length == 1){
                const pass = result[0].rto_pass;
                if(rto_pass == pass){
                    req.session.loggedin = true
                    req.session.user = rto_id
                    req.session.save()
                    console.log('Logged In!')

                    //querying the db for name
                    pool.query('SELECT f_name,l_name FROM rto_login where rto_id = ?', [rto_id], async(err, result)=>{
                        if(err)
                            console.log('Error Retrieving Name!')
                        else if(result.length == 1){
                            data3 = JSON.parse(JSON.stringify(result))
                            if(req.session)
                                res.redirect('/rto_dashboard')
                            else 
                                res.redirect('/')
                        }
                    })
                }
                else{
                    res.render('rto_login', {msg: true})
                }
            }
        }
    })
})

//login route for vehicle owner
app.post('/login', async(req, res)=>{
    const user_id = req.body.username
    const password = req.body.password
    
    //querying the database for stored password
    pool.query('SELECT user_pass FROM user_register WHERE user_id = ?', [user_id], async(err, result)=>{
        if(err)
            console.log('Error Fetching Password from Database!')
        else if(result.length == 1){
            const storedPassword = result[0].user_pass

            //check if entered and stored password match
            const isMatch = await bcrypt.compare(password, storedPassword)
            if(isMatch){
                req.session.loggedin = true
                req.session.user = user_id
                req.session.save()
                console.log('Logged In!')

                //querying the db to fetch name
                pool.query('SELECT f_name,l_name FROM user_register where user_id = ?', [user_id], async(err, result)=>{
                    if(err)
                        console.log('Error Fetching Name!')
                    else if(result.length == 1)
                        data1 = JSON.parse(JSON.stringify(result))                    

                    //querying the db for license validity
                    pool.query('SELECT validity from user_license WHERE user_id = ?', [user_id], async(err, result)=>{
                        if(err)
                            console.log('Error Fetching License Validity')
                        else if(result.length == 1){
                            console.log("I HAVE LICENSE")
                            date = result[0].validity
                            formattedDate = date.toLocaleDateString('en-GB')
                            var currentDate = new Date()    
                            currentDate = currentDate.toLocaleDateString('en-GB')
                            
                            //function that converts to mm/dd/yyyy format
                            function getNumberOfDays(date1, date2){
                                const [day1, month1, year1] = date1.split('/');
                                const [day2, month2, year2] = date2.split('/');
                                const newDate1 = new Date(`${month1}/${day1}/${year1}`);
                                const newDate2 = new Date(`${month2}/${day2}/${year2}`);

                                //calculating difference in days
                                const diffInTime = newDate2.getTime() - newDate1.getTime();
                                const diffInDays = Math.round(diffInTime / oneDay);
                                return diffInDays;
                            }

                            noOfDays = getNumberOfDays(currentDate, formattedDate)
                            if(noOfDays <= 30 && noOfDays >= 1)
                                displayMarquee = true
                            else if(noOfDays < 1){
                                displayMarquee = true
                                expired = true
                            }

                            //querying the db for license details
                            pool.query('SELECT license, address_p, dob, gender FROM user_register INNER JOIN user_license ON user_register.user_id = user_license.user_id WHERE user_register.user_id = ?', [user_id], async(err, result)=>{
                                if(err)
                                    console.log("Error Fetching License Details!")
                                else if(result.length == 1){
                                    var data2 = JSON.parse(JSON.stringify(result))

                                    //function to format date
                                    function formatDate(dateString) {
                                        const date = new Date(dateString);
                                        const day = date.getUTCDate().toString().padStart(2, '0'); // get day as string with leading zero if needed
                                        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0'); // get month as string with leading zero if needed (month is zero-indexed)
                                        const year = date.getUTCFullYear().toString(); // get year as string
                                        return `${day}/${month}/${year}`;
                                    }

                                    data2[0].dob = formatDate(data2[0].dob)

                                    if(req.session)
                                        res.redirect('/dashboard')
                                    else
                                        res.redirect('/')

                                }
                            })
                        }
                        else{
                            console.log("I HAVE NO LICENSE")
                            res.redirect('/dashboard_no_license')
                        }
                    })
                })
            }
            else{
                console.log('Invalid Credentials!')
                res.render('login1', {msg: true})
            }
        }
    })
})

//route for rto dashboard
app.get('/rto_dashboard', async(req, res)=>{
    if(req.session.loggedin){
        res.render('rto_index', {fname:data3[0].f_name, lname:data3[0].l_name})
    }
    else
        res.redirect('/')
})

//route for rto officer logout
app.get('/rto_logout', (req, res)=>{
    req.session.destroy((err)=>{
        if(err)
            console.log('Error Logging Out!')
        else
            res.render('index')
    })
})

//route for vehicle owner dashboard with license details
app.get('/dashboard', async(req, res)=>{
    if(req.session.loggedin){
        res.render('index1', {noOfDays: noOfDays, displayMarquee: displayMarquee, expired: expired, fname:data1[0].f_name, lname:data1[0].l_name, validity: formattedDate, license: data2[0].license, gender: data2[0].gender, dob:data2[0].dob, address:data2[0].address_p})
    }
    else    
        res.redirect('/')
})

//route for vehicle owner without license details
app.get('/dashboard_no_license', async(req, res)=>{
    if(req.session.loggedin){
        res.render('index1', {fname:data1[0].f_name, lname:data1[0].l_name})
    }
    else
        res.redirect('/')
})

//logout route for vehicle owner
app.get('/logout', (req, res)=>{
    req.session.destroy((err)=>{
        if(err)
            console.log('Error Logging Out!')
        else   
            res.render('index')
    })
})

//starting the server
app.listen(3004, ()=>{
    console.log('Server-Port: 3004')
})