# Steel Suvidha Backend

Node.js backend with Express and MongoDB using MVC pattern.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# MongoDB Connection String
# For local MongoDB:
MONGO_URI=mongodb://127.0.0.1:27017/steel_suvidha

# For MongoDB Atlas (cloud):
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/steel_suvidha
# Note: If your password contains special characters, URL-encode them:
# @ → %40, # → %23, $ → %24, % → %25, & → %26, + → %2B, = → %3D, ? → %3F

# Server Port (optional, defaults to 4000)
PORT=4000
```

**Important:** 
- Replace the MongoDB connection string with your actual MongoDB URI.
- For MongoDB Atlas, ensure your IP is whitelisted in Network Access settings.
- URL-encode special characters in passwords if using Atlas.

### 3. Start the Server

```bash
npm start
```

The server will start on `http://localhost:4000` (or the port specified in `.env`).

### 4. Health Check

Visit `http://localhost:4000/health` to verify the server is running.

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login (Buyer, Seller, Admin)
  - Body: `{ username, password, role }`
  - Returns: User data (without password)
- `GET /api/auth/profile/:userId` - Get user profile by ID
  - Returns: User profile data

### Buyers
- `POST /api/buyers/register` - Register a new buyer
  - Body: `{ name, email, username, password, phone?, address?, company? }`
  - Returns: Created buyer data
- `GET /api/buyers/:id` - Get buyer by ID
  - Returns: Buyer profile data

### Sellers
- `POST /api/sellers` - Create a new seller (admin only)
  - Body: `{ name, email, username, password, description? }`
  - Returns: Created seller data
- `GET /api/sellers` - Get all sellers
  - Returns: List of all sellers
- `GET /api/sellers/:id` - Get seller by ID
  - Returns: Seller profile data

### Products
- `POST /api/products` - Create a new product (seller only)
  - Body: `{ name, category, sellerId, metalType?, brand?, grade?, finish?, size?, description?, imageUrl?, price?, quantity?, unit?, sellerName? }`
  - Returns: Created product data
- `GET /api/products` - Get all products (for buyers to view)
  - Query params: `category?`, `metalType?`, `status?`
  - Returns: List of products
- `GET /api/products/seller/:sellerId` - Get products by seller
  - Returns: List of products for a specific seller
- `GET /api/products/:id` - Get product by ID
  - Returns: Product details
- `PUT /api/products/:id` - Update product
  - Body: `{ name?, category?, status?, ... }` (any product fields)
  - Returns: Updated product data
- `DELETE /api/products/:id` - Delete product
  - Returns: Success message

### Users
- `GET /api/users` - Get all users
  - Returns: List of all users (Buyers, Sellers, Admins)

## Database Collections

All data is stored in MongoDB:

### users Collection
Stores all users (Buyers, Sellers, Admins)

**Schema:**
- `_id` - ObjectId
- `name` - String (required)
- `email` - String (required, unique per role)
- `username` - String (required, unique across all roles)
- `password` - String (hashed with bcrypt)
- `role` - String (Buyer, Seller, Admin)
- `status` - String (Active, Inactive)
- `activity` - String (Online, Offline)
- `lastLogin` - Date
- `createdAt` - Date
- `updatedAt` - Date
- `phone` - String (optional, for Buyers)
- `address` - String (optional, for Buyers)
- `company` - String (optional, for Buyers)
- `description` - String (optional, for Sellers)

**Indexes:**
- `{ email: 1, role: 1 }` - Compound unique index (allows same email for different roles)
- `{ username: 1 }` - Unique index (username must be unique across all roles)

### products Collection
Stores all products added by sellers

**Schema:**
- `_id` - ObjectId
- `name` - String (required)
- `category` - String (required)
- `metalType` - String (default: 'Steel')
- `brand` - String (optional)
- `grade` - String (optional)
- `finish` - String (optional)
- `size` - String (optional)
- `description` - String (optional)
- `imageUrl` - String (optional)
- `price` - Number (optional)
- `quantity` - Number (optional)
- `unit` - String (default: 'kg')
- `status` - String (Active, Inactive)
- `sellerId` - String (required, references seller)
- `sellerName` - String (optional)
- `createdAt` - Date
- `updatedAt` - Date

**Indexes:**
- `{ sellerId: 1 }` - Index for seller queries
- `{ category: 1 }` - Index for category filtering
- `{ status: 1 }` - Index for status filtering

## Dependencies

- **express** (^5.1.0) - Web framework
- **mongodb** (^6.19.0) - MongoDB driver
- **bcrypt** (^5.1.1) - Password hashing
- **cors** (^2.8.5) - Cross-Origin Resource Sharing
- **dotenv** (^16.4.5) - Environment variable management

## Project Structure

```
Backend_steel_suvidha/
├── controllers/          # Business logic
│   ├── authController.js
│   ├── buyerController.js
│   ├── productController.js
│   └── sellerController.js
├── models/              # Data models
│   ├── Product.js
│   └── User.js
├── routes/               # API routes
│   ├── authRoutes.js
│   ├── buyerRoutes.js
│   ├── productRoutes.js
│   ├── sellerRoutes.js
│   └── userRoutes.js
├── services/             # Services (database, etc.)
│   └── database.js
├── server.js             # Main server file
├── package.json          # Dependencies
└── .env                  # Environment variables (create this)
```

## Data Storage

All data operations go through MongoDB:
- User registration and authentication (Buyers, Sellers)
- Seller creation and management (by Admin)
- Product creation and management (by Sellers)
- Profile data retrieval
- Login history and activity tracking

**No hardcoded data** - everything is stored in the database.

## Security Features

- Passwords are hashed using bcrypt (10 salt rounds)
- Username must be unique across all roles
- Email can be reused for different roles (Buyer and Seller can have same email)
- Passwords are never returned in API responses

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `409` - Conflict (duplicate email/username)
- `500` - Internal Server Error

Error responses include an `error` field with a descriptive message.
