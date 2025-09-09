# Next Steps

This document outlines potential improvements within the scope of the original project brief.

## Security Improvements

### Authentication Enhancement
**Current State:** Auth tokens are stored in localStorage and sent via Authorization headers.

**Issue:** This approach is vulnerable to XSS attacks since localStorage is accessible via JavaScript.

**Recommended Fix:**
- Switch from localStorage to httpOnly cookies for token storage
- Configure CORS properly for cookie-based authentication
- Set appropriate SameSite cookie policies
- Consider moving to same-origin deployment (both frontend/backend on same port)


## Feature Extensions

### Group Chats
**Description:** Extend the current 1:1 DM functionality to support group conversations with multiple participants.

**Implementation Requirements:**
1. **Database Changes:**
   - Current schema already supports multiple participants per thread
   - No schema changes needed (already designed for scalability)

2. **Backend Changes:**
   - Update thread creation logic to accept multiple target users
   - Modify thread display logic to show group names
   - Enhance Socket.io room management for group broadcasting

3. **Frontend Changes:**
   - Add group creation UI in ThreadList component
   - Update ChatInterface header to show multiple participants  
   - Handle group-specific message display (always show sender names)

4. **Core Features:**
   - Group naming system
   - Basic participant management
   - Group message broadcasting via existing real-time system


### Technical Enhancements

#### Performance Optimizations
- **Message pagination** for threads with many messages
- **Connection resilience** for Socket.io (reconnection handling)
- **Rate limiting** on message sending to prevent spam

## Recent Fixes

- **Duplicate thread creation** - Seeding script now prevents duplicates
- **Message sender attribution** - Fixed duplicate message rendering bug
- **TypeScript errors** - Resolved tRPC configuration issues, linked to when I tried to implement cookie based auth and switched to localStorage auth

