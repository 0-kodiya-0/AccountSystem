# Todo App - Authentication SDK Testing Application

A comprehensive Todo application built to test and demonstrate the functionality of both the Node.js and React authentication SDKs.

## 🎯 Purpose

This application serves as a complete testing environment for your authentication microservice clients:

- **Backend SDK Testing**: Express.js server using `auth-node-sdk`
- **Frontend SDK Testing**: Next.js application using `auth-react-sdk`
- **Real-world Integration**: Functional todo app demonstrating practical usage

## 🏗️ Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Next.js Frontend  │    │   Express Backend   │    │   Auth Microservice │
│   (auth-react-sdk)  │◄──►│   (auth-node-sdk)   │◄──►│   (Your Service)    │
│                     │    │                     │    │                     │
│ - Session hooks     │    │ - Auth middleware   │    │ - User management   │
│ - Auth guards       │    │ - Token validation  │    │ - Token generation  │
│ - Account management│    │ - Permission checks │    │ - Session handling  │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## 🚀 Features

### Frontend Features (React SDK)

- ✅ Session management with `useSession`
- ✅ Account data management with `useAccount`
- ✅ Route protection with `AuthGuard`
- ✅ Automatic token handling
- ✅ Loading and error states
- ✅ Real-time authentication status

### Backend Features (Node.js SDK)

- ✅ Authentication middleware
- ✅ Token verification (HTTP & Socket)
- ✅ User data loading
- ✅ Permission checking
- ✅ Session validation
- ✅ Account access control

### Application Features

- 📝 Complete CRUD todo operations
- 🔍 Search and filtering
- 📊 Statistics dashboard
- 🧪 Comprehensive testing interface
- 🔐 Protected routes and API endpoints

## 📋 Prerequisites

1. **Auth Microservice**: Your authentication service running on port 4000
2. **Node.js**: Version 18 or higher
3. **Package Access**: Your published auth SDK packages

## 🛠️ Setup Instructions

### 1. Install Dependencies

**Backend:**

```bash
cd backend
npm install
```

**Frontend:**

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

**Backend (.env):**

```bash
# Server Configuration
NODE_ENV=development
PORT=5000

# Frontend Configuration
FRONTEND_URL=http://localhost:3000

# Auth Service Configuration
AUTH_SERVICE_URL=http://localhost:4000
AUTH_SERVICE_ID=todo-app-service
AUTH_SERVICE_NAME=Todo App Backend
AUTH_SERVICE_SECRET=your-service-secret-here

# Account Server Configuration (for token refresh redirects)
ACCOUNT_SERVER_URL=http://localhost:4000

# Socket Configuration (optional)
PREFER_SOCKET=false
```

**Frontend (.env.local):**

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:4000
```

### 3. Update Package References

Replace `@your-org/auth-node-sdk` and `@your-org/auth-react-sdk` with your actual package names in:

**Backend:**

- `src/config/auth.js`
- `src/middleware/auth.js`

**Frontend:**

- `src/components/auth/AuthProvider.tsx`
- `src/components/auth/AuthStatus.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/auth/page.tsx`

### 4. Start the Applications

**Backend:**

```bash
cd backend
npm run dev
```

**Frontend:**

```bash
cd frontend
npm run dev
```

## 🧪 Testing the SDKs

### 1. Authentication Flow

1. Visit `http://localhost:3000`
2. Click "Login" to access the external auth service
3. Complete authentication
4. Return to the todo app

### 2. SDK Feature Testing

**Frontend SDK Testing:**

- Navigate to `/auth` for comprehensive auth status
- Test session hooks and account management
- Verify route protection and guards

**Backend SDK Testing:**

- Access `/dashboard` for protected todo operations
- Test HTTP vs Socket client preferences
- Verify token validation and middleware

### 3. API Endpoint Testing

**Authentication Endpoints:**

```bash
# Get auth status
GET http://localhost:5000/api/auth/status

# Get current user (requires auth)
GET http://localhost:5000/api/auth/me

# Test permissions
GET http://localhost:5000/api/auth/permissions/email-verified
```

**Todo Endpoints:**

```bash
# Get todos (requires auth)
GET http://localhost:5000/api/todos

# Create todo (requires auth)
POST http://localhost:5000/api/todos
Content-Type: application/json
{
  "title": "Test todo",
  "description": "Testing the API",
  "priority": "high"
}
```

## 📁 Project Structure

```
auth-todo-app/
├── backend/
│   ├── src/
│   │   ├── config/auth.js           # Auth SDK configuration
│   │   ├── middleware/auth.js       # Authentication middleware
│   │   ├── routes/
│   │   │   ├── todos.js            # Todo CRUD operations
│   │   │   └── auth.js             # Auth testing endpoints
│   │   ├── utils/database.js       # In-memory database
│   │   └── index.js                # Express server
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Home page
│   │   │   ├── dashboard/page.tsx  # Protected todo dashboard
│   │   │   └── auth/page.tsx       # Auth testing interface
│   │   ├── components/
│   │   │   ├── auth/               # Auth components
│   │   │   ├── todos/              # Todo components
│   │   │   └── ui/                 # UI components
│   │   └── lib/
│   │       ├── auth.ts             # Auth configuration
│   │       └── api.ts              # API client
│   ├── package.json
│   └── .env.local.example
└── README.md
```

## 🔧 Configuration Options

### Backend SDK Configuration

```javascript
// src/config/auth.js
const authConfig = {
  baseUrl: 'http://localhost:4000',
  serviceId: 'todo-app-service',
  serviceSecret: 'your-secret',
  enableLogging: true,
  preferSocket: false, // Set to true to test socket client
  accountServerBaseUrl: 'http://localhost:4000',
};
```

### Frontend SDK Configuration

```typescript
// src/lib/auth.ts
export const authConfig: SDKConfig = {
  backendUrl: 'http://localhost:5000',
  timeout: 30000,
  withCredentials: true,
  proxyPath: '/api',
};
```

## 🧪 Testing Scenarios

### 1. Basic Authentication

- [ ] User can authenticate via external service
- [ ] Session state updates correctly
- [ ] Protected routes require authentication
- [ ] Logout clears session state

### 2. Token Management

- [ ] Access tokens are automatically included in requests
- [ ] Token refresh works seamlessly
- [ ] Invalid tokens are handled gracefully
- [ ] Token expiration triggers proper redirects

### 3. Permission Systems

- [ ] Account type restrictions work correctly
- [ ] Email verification requirements are enforced
- [ ] Custom permission validators function
- [ ] Permission errors provide clear feedback

### 4. Client Preferences

- [ ] HTTP client functions correctly
- [ ] Socket client connects and operates
- [ ] Client switching works seamlessly
- [ ] Fallback mechanisms operate properly

### 5. Error Handling

- [ ] Network errors are handled gracefully
- [ ] API errors display appropriate messages
- [ ] Auth service unavailability is managed
- [ ] Invalid responses don't break the application

## 🐛 Troubleshooting

### Common Issues

**1. "Auth service connection failed"**

- Ensure your auth microservice is running on port 4000
- Verify the `AUTH_SERVICE_URL` environment variable
- Check firewall/network connectivity

**2. "CORS errors in browser"**

- Verify frontend URL is configured in backend CORS settings
- Check `FRONTEND_URL` environment variable in backend
- Ensure cookies are enabled for cross-origin requests

**3. "Package not found errors"**

- Update import statements with your actual package names
- Ensure SDK packages are published and accessible
- Check package.json dependencies

**4. "Socket connection failed"**

- Set `PREFER_SOCKET=false` to use HTTP only
- Verify socket namespace configuration
- Check auth service socket implementation

### Debug Mode

Enable detailed logging by setting:

```bash
NODE_ENV=development
```

This will show:

- Detailed SDK operation logs
- Network request/response details
- Authentication flow steps
- Error stack traces

## 📊 Performance Considerations

- **Database**: Uses in-memory storage (not for production)
- **Authentication**: Cached session data reduces API calls
- **Network**: Socket client reduces HTTP overhead when available
- **Frontend**: Optimized re-renders with proper React hooks

## 🤝 Contributing

This is a testing application. To extend functionality:

1. Add new test scenarios in `/auth` page
2. Create additional protected routes
3. Test edge cases and error conditions
4. Add more comprehensive API endpoints

## 📄 License

This testing application is for development and testing purposes only.

---

**Happy Testing! 🎉**

This application comprehensively tests both authentication SDKs in a real-world scenario. Use it to verify functionality, performance, and integration before deploying to production.
