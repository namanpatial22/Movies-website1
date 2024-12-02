const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const marked = require('marked');


const app = express();
const db = new sqlite3.Database("./db/database.sqlite");

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static("public"));



const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads'); // Directory where posters are saved
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`); // Unique filename
    },
});

// Initialize Multer
const upload = multer({ storage: storage });

// Initialize the database
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS movies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        description TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        movie_id INTEGER,
        user_id INTEGER,
        review TEXT,
        FOREIGN KEY(movie_id) REFERENCES movies(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
});

// Middleware for authentication

app.use((req, res, next) => {
    req.user = { username: "testuser" }; // Simulate a logged-in user for testing
    next();
});



//Routes

app.get("/login", (req, res) => {
    res.render("login"); // Render the login.ejs page
});


app.get("/add-movie", (req, res) => {
    if (!req.user) {
        return res.redirect("/login"); // Redirect to login if not logged in
    }
    res.render("add-movie"); // Render the form
});





app.get("/", (req, res) => {
    db.all("SELECT * FROM movies", (err, movies) => {
        if (err) {
            return res.status(500).send("Database error.");
        }
        res.render("index", { movies });
    });
});




app.get("/movie/:id", (req, res) => {
    const movieId = req.params.id;

    db.serialize(() => {
        // Fetch movie details
        db.get("SELECT * FROM movies WHERE id = ?", [movieId], (err, movie) => {
            if (err || !movie) {
                console.log("Error fetching movie or movie not found:", err || "No movie");
                return res.status(404).send("Movie not found.");
            }
            console.log("Movie fetched:", movie);
        
        

            // Fetch reviews for the movie
            db.all(
                "SELECT * FROM reviews WHERE movie_id = ? ORDER BY created_at DESC",
                [movieId],
                (err, reviews) => {
                    if (err) {
                        return res.status(500).send("Database error.");
                    }

                    // Render the movie.ejs template and pass data
                    res.render("movie", {
                        movie, 
                        reviews, 
                        req,
                        isLoggedIn: req.user ? true : false,
                    });
                }
            );
        });
    });
});









app.post("/review/:id", (req, res) => {
    const movieId = req.params.id;
    const { userId, review } = req.body;

    db.run("INSERT INTO reviews (movie_id, user_id, review) VALUES (?, ?, ?)", 
        [movieId, userId, review], 
        (err) => {
            if (err) return res.status(500).send("Database error.");
            res.redirect(`/movie/${movieId}`);
        }
    );
});




app.post('/add-movie', (req, res) => {
    const { title, description, year, director, posterPath } = req.body;

    db.run(
        'INSERT INTO movies (title, description, year, director, poster) VALUES (?, ?, ?, ?, ?)',
        [title, description, year, director, posterPath || ''],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Database error.');
            }
            res.redirect('/');
        }
    );
});


app.post("/login", (req, res) => {
    const { username, password } = req.body;
    // Replace the following with your user authentication logic
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
        if (err) return res.status(500).send("Database error");
        if (!user) return res.status(401).send("Invalid credentials");
        req.user = user; // Set the logged-in user
        res.redirect("/"); // Redirect to homepage after login
    });
});

// Add a Review
app.post("/movie/:id/review", (req, res) => {
    console.log(req.body); // Log the incoming form data for debugging

    const { id } = req.params;
    const { userId, rating, review } = req.body;

    db.run(
        `INSERT INTO reviews (movie_id, user_id, rating, review, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [id, userId, rating, review],
        (err) => {
            if (err) return res.status(500).send("Database error.");
            res.redirect(`/movie/${id}`);
        }
    );
});



app.post('/upload-poster', upload.single('poster'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Return the file path to the client
    res.json({
        success: true,
        filePath: `/uploads/${req.file.filename}`,
    });
});


app.listen(5500, () => console.log("Server running on http://localhost:5500"));
