# cordova-plugin-hubspot-chat

Cordova plugin for HubSpot Mobile Chat SDK (iOS & Android).

## Installation

From GitHub:

```bash
cordova plugin add https://github.com/romanlazurenko/cordova-plugin-hubspot-chat.git \
  --variable HUBSPOT_PORTAL_ID=YOUR_PORTAL_ID \
  --variable HUBSPOT_HUBLET=eu1 \
  --variable HUBSPOT_DEFAULT_CHAT_FLOW=default
```

From local path:

```bash
cordova plugin add /path/to/cordova-plugin-hubspot-chat \
  --variable HUBSPOT_PORTAL_ID=YOUR_PORTAL_ID \
  --variable HUBSPOT_HUBLET=eu1 \
  --variable HUBSPOT_DEFAULT_CHAT_FLOW=default
```

## Configuration

### Required Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HUBSPOT_PORTAL_ID` | Your HubSpot Portal ID | (required) |
| `HUBSPOT_HUBLET` | Your HubSpot data center region (`eu1`, `na1`, etc.) | `eu1` |
| `HUBSPOT_DEFAULT_CHAT_FLOW` | Default chat flow name | `default` |

### Finding Your HubSpot Configuration

1. **Portal ID**: Found in HubSpot Settings > Account Management > Account Defaults
2. **Hublet**: Check your HubSpot URL:
   - `app.hubspot.com` → `na1`
   - `app-eu1.hubspot.com` → `eu1`
3. **Chat Flow**: Create a mobile-enabled chatflow in HubSpot > Conversations > Chatflows

### iOS Setup

The plugin automatically:
- Creates `Hubspot-Info.plist` with your configuration
- Adds HubSpot SDK via Swift Package Manager
- Configures the Xcode project

**Requirements:**
- iOS 15.0+ (set in your `config.xml`)
- Xcode 14+

Add to your `config.xml`:
```xml
<preference name="deployment-target" value="15.0" />
```

### Android Setup

The plugin automatically creates `hubspot-info.json` in your Android assets folder.

**Requirements:**
- Android API 24+

## Usage

### Show Chat

```javascript
// Open with default chat flow
HubspotChat.show(
  function() { console.log('Chat opened'); },
  function(error) { console.error('Error:', error); }
);

// Open with specific chat flow
HubspotChat.show('sales',
  function() { console.log('Chat opened'); },
  function(error) { console.error('Error:', error); }
);
```

### Hide Chat

```javascript
HubspotChat.hide(
  function() { console.log('Chat closed'); },
  function(error) { console.error('Error:', error); }
);
```

### Set User Identity

Use this with HubSpot's Visitor Identification API for authenticated users:

```javascript
// With identity token (recommended for authenticated users)
HubspotChat.setUserIdentity('user@example.com', 'jwt-identity-token',
  function() { console.log('Identity set'); },
  function(error) { console.error('Error:', error); }
);

// Email only (anonymous identification)
HubspotChat.setUserIdentity('user@example.com',
  function() { console.log('Identity set'); },
  function(error) { console.error('Error:', error); }
);
```

### Set Chat Properties

```javascript
HubspotChat.setChatProperties({
  'subscription-tier': 'premium',
  'user-type': 'customer'
},
  function() { console.log('Properties set'); },
  function(error) { console.error('Error:', error); }
);
```

### Logout / Clear User Data

```javascript
HubspotChat.logout(
  function() { console.log('User data cleared'); },
  function(error) { console.error('Error:', error); }
);
```

## HubSpot Dashboard Setup

For the chat to work, you must configure a chatflow in HubSpot:

1. Go to **HubSpot > Conversations > Chatflows**
2. Create or edit a chatflow
3. In **Target** settings, enable **"Mobile SDK"**
4. **Publish** the chatflow
5. Use the chatflow's internal name as `HUBSPOT_DEFAULT_CHAT_FLOW`

## Troubleshooting

### "The system isn't responding" error

This usually means:
- Chatflow not published or not enabled for Mobile SDK
- Wrong `HUBSPOT_HUBLET` value
- Wrong `HUBSPOT_DEFAULT_CHAT_FLOW` name

### iOS build errors

1. Ensure iOS deployment target is 15.0+
2. Clean build folder in Xcode
3. Delete `platforms/ios` and re-add: `cordova platform add ios`

### SDK not configured error

Check that `Hubspot-Info.plist` exists in your iOS app bundle with correct values.

## Platform Support

- iOS 15.0+
- Android API 24+

## Dependencies

- **iOS**: HubSpot Mobile SDK via Swift Package Manager
- **Android**: `com.hubspot.mobilechatsdk:mobile-chat-sdk-android:1.0.+`

## License

MIT
