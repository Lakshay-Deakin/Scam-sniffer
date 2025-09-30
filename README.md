Scam Sniffer

Scam Sniffer is a web application to detect / analyze potential scams in shared content. It’s built using Node.js, Express, Socket.io, MongoDB, and more.

Table of Contents

1.Features

2.Tech Stack

3.Architecture & Structure

4.Installation & Setup

5.Environment Variables

6.Database & Models

7.API / Routes / Endpoints
   Auth / Users
   Analysis / Socket routes
   Admin

8.Socket.io Communication

9.Middleware & Utilities

10.Running & Deployment

11.Future Improvements / TODOs

Features
    User registration, login, session-based authentication
    Role-based access (e.g. admin)
    Real-time analysis / processing via Socket.io
    Persist sessions using MongoDB + connect-mongo
    Serve static front-end pages
    RESTful routes and modular route structure
    Basic security (password hashing, session cookies)

Tech Stack
    Node.js
    Express
    MongoDB (Atlas / cloud)
    Mongoose (ODM)
    express-session + connect-mongo (session store)
    bcrypt (password hashing)
    Socket.io (real-time communication)
    HTML / CSS / front-end (in public/)

Architecture & Structure
    Express sets up middleware (body parser, session, static file serving, auth tools)
    Routes are mounted modularly (e.g. /users, /analyze, /admin)
    Socket.io is initialized and passed to route modules so they can define real-time behavior
    Authentication is done via sessions; res.locals.user is attached
    Protected routes use middleware (e.g. isAuthenticated, isAdmin)

Installation & Setup
  Clone the repo git clone https://github.com/Lakshay-Deakin/Scam-sniffer.git
  Install Dependencies using npm install 
  Run the app npm start 
  if there is anything missing you have to download that module using npm install <module name>

Environment Variables
  Using port, mongo-db url and session secret 

Database & Models
    The schema(s) we use:
    User model
    Save Analysis


API / Routes / Endpoints
    Users / Auth routes (in routes/users.js)
    Method	Path	Description	Protection
    GET	/users/signup	Serve signup page	public
    GET	/users/signin	Serve signin page	public
    POST	/users/register	Create new user, hash password	public
    POST	/users/login	Login existing user, set session	public
    GET	/users/logout	Destroy session, logout	authenticated

    Analysis / Socket routes (in routes/analyse.js)
    Socket.io event listeners / emitters, to update active users, analysis and common scam phrase.

    Admin routes (in routes/admin.js)
    Protected using isAuthenticated + isAdmin.

Socket.io Communication
    Document the real-time protocol between client and server:
    On client connection, server emits userCount (number of live users)
    Client may send e.g. analyze event with payload { ... }
    Server processes, then emits something like analysisResult or analysisUpdate
    Disconnection handling
    Common phrase detection

Middleware & Utilities
    You have a few helper / middleware modules, e.g.:
    withUser — attaches the currently logged-in user (from session) into res.locals
    isAuthenticated — ensures route access only for logged-in users
    isAdmin — ensures only admins may access
    mountAuthEndpoints — mounts endpoints to query auth status (e.g. /auth/status)
    
Running & Deployment
    Use npm start (or a script defined in package.json)
    Deployed to render

Future Improvements / TODOs
    We will implement analyser using machine learning nlp algorithm.

