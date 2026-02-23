const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: "sweetroyalssecret",
    resave: false,
    saveUninitialized: true
}));

/* ================= LOGIN PAGE ================= */
app.get("/", (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Sweet Royals Login</title>
            <style>
                body{
                    font-family:Arial;
                    background:#bfc3db;
                    display:flex;
                    justify-content:center;
                    align-items:center;
                    height:100vh;
                }
                .box{
                    background:white;
                    padding:30px;
                    border-radius:10px;
                    width:300px;
                    text-align:center;
                }
                input{
                    width:100%;
                    padding:8px;
                    margin:8px 0;
                }
                button{
                    padding:10px;
                    width:100%;
                    background:#a6782e;
                    color:white;
                    border:none;
                }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>Sweet Royals Login</h2>
                <form method="POST" action="/login">
                    <input name="username" placeholder="Username" required>
                    <input name="password" type="password" placeholder="Password" required>
                    <button type="submit">Login</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

/* ================= LOGIN LOGIC ================= */
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (username === "admin" && password === "1234") {
        req.session.user = {
            name: "Administrator",
            number: "09123456789",
            location: "Rizal, Nueva Ecija"
        };
        res.redirect("/menu");
    } else {
        res.send("Invalid username or password. <a href='/'>Try again</a>");
    }
});

/* ================= MENU PAGE ================= */
app.get("/menu", (req, res) => {
    if (!req.session.user) return res.redirect("/");

    res.send(`
        <html>
        <head>
            <title>Menu</title>
            <style>
                body{font-family:Arial;background:#bfc3db;margin:0;padding:20px;}
                .header{display:flex;justify-content:space-between;}
                button{padding:8px 15px;margin:5px;}
                .product{background:white;padding:15px;margin:10px 0;border-radius:10px;}
            </style>
        </head>
        <body>
            <div class="header">
                <h2>Welcome, ${req.session.user.name}</h2>
                <div>
                    <a href="/profile"><button>Profile</button></a>
                    <a href="/logout"><button>Logout</button></a>
                </div>
            </div>

            <div class="product">
                <h3>Strawberry Cake - PHP 211</h3>
            </div>

            <div class="product">
                <h3>Cookie - PHP 36</h3>
            </div>

            <div class="product">
                <h3>Pudding - PHP 20</h3>
            </div>
        </body>
        </html>
    `);
});

/* ================= PROFILE PAGE ================= */
app.get("/profile", (req, res) => {
    if (!req.session.user) return res.redirect("/");

    res.send(`
        <html>
        <head>
            <title>Profile</title>
            <style>
                body{font-family:Arial;background:#bfc3db;padding:40px;text-align:center;}
                .box{background:white;padding:20px;border-radius:10px;width:300px;margin:auto;}
                input{width:100%;padding:8px;margin:5px 0;}
                button{padding:8px 15px;margin:5px;}
            </style>
        </head>
        <body>
            <div class="box">
                <h2>My Profile</h2>
                <p><b>Name:</b> ${req.session.user.name}</p>
                <p><b>Number:</b> ${req.session.user.number}</p>
                <p><b>Location:</b> ${req.session.user.location}</p>

                <form method="POST" action="/update-profile">
                    <input name="name" placeholder="New Name" required>
                    <input name="number" placeholder="New Number" required>
                    <input name="location" placeholder="New Location" required>
                    <button type="submit">Save Changes</button>
                </form>

                <a href="/menu"><button>Back to Menu</button></a>
            </div>
        </body>
        </html>
    `);
});

/* ================= UPDATE PROFILE ================= */
app.post("/update-profile", (req, res) => {
    if (!req.session.user) return res.redirect("/");

    req.session.user.name = req.body.name;
    req.session.user.number = req.body.number;
    req.session.user.location = req.body.location;

    res.redirect("/profile");
});

/* ================= LOGOUT ================= */
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

/* ================= START SERVER ================= */
app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});