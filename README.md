# Digital Wallet Application

A complete digital wallet system with user and admin dashboards, transaction management, analytics, and notifications.

## Features

- 🔐 User Authentication (Login/Register with JWT)
- 💰 Deposit, Withdraw, and Send Money
- 📊 Transaction History with Search
- 👥 Beneficiary Management
- 📈 User Dashboard with Spending Charts
- 👑 Admin Dashboard with User Management
- 📉 Analytics Dashboard with Line, Pie, and Bar Charts
- 🔔 Real-time Notifications
- 👤 Profile Management
- 💵 USD Currency Support

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| User (Laiba) | bsse2480204@szabist.pk | password123 |
| User (Shahla) | bsse2480221@szabist.pk | password123 |
| Admin | admin@digitalwallet.com | password123 |

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (Neon Tech)
- **Frontend**: HTML, CSS, JavaScript
- **Authentication**: JWT, bcryptjs
- **Charts**: Chart.js
- **Icons**: Font Awesome

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v14 or higher)
- [Git](https://git-scm.com/)
- A PostgreSQL database ([Neon Tech](https://neon.tech/) recommended - free)

## Installation Steps

### 1. Clone the repository

```bash
git clone https://github.com/Laiba-Kanwal-04/digital-wallet-app.git
cd digital-wallet-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up the database

#### Using Neon Tech (Recommended - Free)

1. Go to [Neon Tech](https://neon.tech/) and create a free account
2. Create a new project
3. Copy your database connection string

### 4. Configure environment variables

Create a `.env` file in the root directory:

```env
PORT=5000
DATABASE_URL="your_postgresql_connection_string"
JWT_SECRET=your_secret_key_here
```

> **Important**: Replace `your_postgresql_connection_string` with your actual database URL and choose a strong `JWT_SECRET`.

### 5. Run the database schema

Run the `db-schema.sql` file in your database:

- **Using Neon Console**: Copy and paste the entire SQL script

### 6. Start the application

```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

### 7. Access the application

Open your browser and navigate to:
```
http://localhost:5000
```

## Project Structure

```
digital-wallet-app/
├── src/
│   ├── server.js           # Main server file
│   ├── db/
│   │   └── database.js     # Database connection
│   ├── routes/
│   │   ├── users.js        # User routes
│   │   ├── transactions.js # Transaction routes
│   │   └── admin.js        # Admin routes
│   └── middleware/
│       └── auth.js         # JWT authentication
├── public/
│   ├── index.html          # Main HTML file
│   ├── css/
│   │   └── style.css       # Styles
│   └── js/
│       ├── app.js          # Main frontend logic
│       ├── charts.js       # Chart configurations
│       └── utils.js        # Utility functions
├── db-schema.sql     # Complete database schema
├── package.json
├── .env.example            # Example environment variables
└── README.md
```

## API Endpoints

### Public Routes
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - Login user
- `GET /api/health` - Health check

### Protected Routes (Requires Authentication)
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `GET /api/users/notifications` - Get notifications
- `GET /api/users/beneficiaries` - Get beneficiaries
- `POST /api/transactions/deposit` - Deposit money
- `POST /api/transactions/withdraw` - Withdraw money
- `POST /api/transactions/transfer` - Send money
- `GET /api/transactions/history` - Get transaction history

### Admin Routes (Requires Admin Role)
- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id` - Update user
- `PUT /api/admin/users/:id/status` - Block/Enable user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/stats` - System statistics
- `GET /api/admin/transactions` - All transactions

## Testing the API with cURL

```bash
# Health check
curl http://localhost:5000/api/health

# Login
curl -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@digitalwallet.com","password":"password123"}'

# Get profile (replace TOKEN with actual token)
curl -X GET http://localhost:5000/api/users/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Troubleshooting

### Port already in use
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9
# Then restart
npm start
```

### Database connection failed
- Check your internet connection
- Verify DATABASE_URL in .env file
- Ensure Neon database is active

### Node modules not found
```bash
rm -rf node_modules package-lock.json
npm install
```

## Support

For issues or questions, please open an issue on GitHub.

## License

This project is for educational purposes.

---

**Happy Coding!** 

## What Users Need to Do (Summary):

1. **Clone the repository**
2. **Run `npm install`**
3. **Create a Neon database** (or use local PostgreSQL)
4. **Copy database connection string**
5. **Create `.env` file** with their database URL
6. **Run the `db-schema.sql`** in their database
7. **Run `npm start`**
8. **Open browser to `http://localhost:5000`**

