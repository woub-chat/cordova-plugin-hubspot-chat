#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

module.exports = function (context) {
  const projectRoot = context.opts.projectRoot;
  const platformPath = path.join(projectRoot, "platforms", "ios");

  if (!fs.existsSync(platformPath)) {
    console.log("[HubspotChat] iOS platform not found, skipping setup");
    return;
  }

  const projectName = getProjectName(projectRoot);
  
  // Get variables
  const variables = getPluginVariables(context, projectRoot);
  
  // Create HubSpot-Info.plist
  createHubSpotInfoPlist(platformPath, projectName, variables);
  
  // Add SPM dependency and plist to project
  addToXcodeProject(platformPath, projectName, variables);
};

function getPluginVariables(context, projectRoot) {
  let portalId = "";
  let hublet = "";
  let defaultChatFlow = "default";

  // Try to get from context
  if (context.opts && context.opts.plugin && context.opts.plugin.pluginInfo) {
    const prefs = context.opts.plugin.pluginInfo.getPreferences();
    if (prefs.HUBSPOT_PORTAL_ID) portalId = prefs.HUBSPOT_PORTAL_ID;
    if (prefs.HUBSPOT_HUBLET) hublet = prefs.HUBSPOT_HUBLET;
    if (prefs.HUBSPOT_HUB_ID && !hublet) hublet = prefs.HUBSPOT_HUB_ID;
    if (prefs.HUBSPOT_DEFAULT_CHAT_FLOW) defaultChatFlow = prefs.HUBSPOT_DEFAULT_CHAT_FLOW;
  }

  // Try fetch.json
  if (!portalId || !hublet) {
    const fetchJsonPath = path.join(projectRoot, "plugins", "fetch.json");
    if (fs.existsSync(fetchJsonPath)) {
      try {
        const fetchJson = JSON.parse(fs.readFileSync(fetchJsonPath, "utf8"));
        const pluginConfig = fetchJson["cordova-plugin-hubspot-chat"];
        if (pluginConfig && pluginConfig.variables) {
          if (pluginConfig.variables.HUBSPOT_PORTAL_ID && !portalId) {
            portalId = pluginConfig.variables.HUBSPOT_PORTAL_ID;
          }
          if (pluginConfig.variables.HUBSPOT_HUBLET && !hublet) {
            hublet = pluginConfig.variables.HUBSPOT_HUBLET;
          }
          if (pluginConfig.variables.HUBSPOT_HUB_ID && !hublet) {
            hublet = pluginConfig.variables.HUBSPOT_HUB_ID;
          }
          if (pluginConfig.variables.HUBSPOT_DEFAULT_CHAT_FLOW) {
            defaultChatFlow = pluginConfig.variables.HUBSPOT_DEFAULT_CHAT_FLOW;
          }
        }
      } catch (e) {
        console.log("[HubspotChat] Could not parse fetch.json");
      }
    }
  }

  // Try config.xml
  if (!portalId || !hublet) {
    const configXmlPath = path.join(projectRoot, "config.xml");
    if (fs.existsSync(configXmlPath)) {
      const configXml = fs.readFileSync(configXmlPath, "utf8");
      const portalIdMatch = configXml.match(/HUBSPOT_PORTAL_ID["\s]*value="([^"]+)"/);
      const hubletMatch = configXml.match(/HUBSPOT_HUBLET["\s]*value="([^"]+)"/);
      const hubIdMatch = configXml.match(/HUBSPOT_HUB_ID["\s]*value="([^"]+)"/);
      const chatFlowMatch = configXml.match(/HUBSPOT_DEFAULT_CHAT_FLOW["\s]*value="([^"]+)"/);

      if (portalIdMatch && !portalId) portalId = portalIdMatch[1];
      if (hubletMatch && !hublet) hublet = hubletMatch[1];
      if (hubIdMatch && !hublet) hublet = hubIdMatch[1];
      if (chatFlowMatch) defaultChatFlow = chatFlowMatch[1];
    }
  }

  if (!hublet || /^\d+$/.test(hublet)) {
    hublet = "eu1";
  }

  return { portalId, hublet, defaultChatFlow };
}

function createHubSpotInfoPlist(platformPath, projectName, variables) {
  const plistPath = path.join(platformPath, projectName, "Hubspot-Info.plist");
  
  if (fs.existsSync(plistPath)) {
    console.log("[HubspotChat] Hubspot-Info.plist already exists");
    return;
  }

  if (!variables.portalId || !variables.hublet) {
    console.log("[HubspotChat] Warning: HUBSPOT_PORTAL_ID or HUBSPOT_HUBLET not set");
    return;
  }

  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>portalId</key>
    <string>${variables.portalId}</string>
    <key>hublet</key>
    <string>${variables.hublet}</string>
    <key>environment</key>
    <string>prod</string>
    <key>defaultChatFlow</key>
    <string>${variables.defaultChatFlow}</string>
</dict>
</plist>`;

  fs.writeFileSync(plistPath, plistContent);
  console.log("[HubspotChat] Created Hubspot-Info.plist");
}

function addToXcodeProject(platformPath, projectName, variables) {
  const pbxprojPath = path.join(platformPath, `${projectName}.xcodeproj`, "project.pbxproj");

  if (!fs.existsSync(pbxprojPath)) {
    console.log("[HubspotChat] project.pbxproj not found");
    return;
  }

  let pbxproj = fs.readFileSync(pbxprojPath, "utf8");
  let modified = false;

  // Generate UUIDs
  const packageRefUUID = generateUUID();
  const packageProductUUID = generateUUID();
  const plistFileRefUUID = generateUUID();
  const plistBuildFileUUID = generateUUID();

  // Add Hubspot-Info.plist to PBXFileReference section
  if (!pbxproj.includes("Hubspot-Info.plist")) {
    const fileRefEntry = `\t\t${plistFileRefUUID} /* Hubspot-Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = "Hubspot-Info.plist"; sourceTree = "<group>"; };\n`;
    
    pbxproj = pbxproj.replace(
      /(\/\* Begin PBXFileReference section \*\/\n)/,
      `$1${fileRefEntry}`
    );

    // Add to PBXBuildFile section
    const buildFileEntry = `\t\t${plistBuildFileUUID} /* Hubspot-Info.plist in Resources */ = {isa = PBXBuildFile; fileRef = ${plistFileRefUUID} /* Hubspot-Info.plist */; };\n`;
    
    pbxproj = pbxproj.replace(
      /(\/\* Begin PBXBuildFile section \*\/\n)/,
      `$1${buildFileEntry}`
    );

    // Add to main group (find the group that contains other files like Info.plist)
    const mainGroupMatch = pbxproj.match(
      /([A-F0-9]{24})\s*\/\*\s*\w+\s*\*\/\s*=\s*\{[^}]*isa\s*=\s*PBXGroup[^}]*children\s*=\s*\([^)]*Info\.plist[^)]*\)/
    );
    
    if (mainGroupMatch) {
      pbxproj = pbxproj.replace(
        /(children\s*=\s*\([^)]*)(Info\.plist[^,]*,)/,
        `$1$2\n\t\t\t\t${plistFileRefUUID} /* Hubspot-Info.plist */,`
      );
    }

    // Add to Resources build phase
    pbxproj = pbxproj.replace(
      /(\/\* Resources \*\/\s*=\s*\{[^}]*files\s*=\s*\()([^)]*\))/,
      `$1\n\t\t\t\t${plistBuildFileUUID} /* Hubspot-Info.plist in Resources */,$2`
    );

    modified = true;
    console.log("[HubspotChat] Added Hubspot-Info.plist to Xcode project");
  }

  // Add Swift Package Manager dependency
  if (!pbxproj.includes("mobile-chat-sdk-ios")) {
    // Add XCRemoteSwiftPackageReference section
    if (!pbxproj.includes("XCRemoteSwiftPackageReference section")) {
      const remotePackageSection = `/* Begin XCRemoteSwiftPackageReference section */
\t\t${packageRefUUID} /* XCRemoteSwiftPackageReference "mobile-chat-sdk-ios" */ = {
\t\t\tisa = XCRemoteSwiftPackageReference;
\t\t\trepositoryURL = "https://github.com/HubSpot/mobile-chat-sdk-ios";
\t\t\trequirement = {
\t\t\t\tkind = upToNextMajorVersion;
\t\t\t\tminimumVersion = 1.0.0;
\t\t\t};
\t\t};
/* End XCRemoteSwiftPackageReference section */

`;
      pbxproj = pbxproj.replace(/([\s\S]*)(rootObject\s*=)/, "$1" + remotePackageSection + "$2");
    }

    // Add XCSwiftPackageProductDependency section
    if (!pbxproj.includes("XCSwiftPackageProductDependency section")) {
      const productDepSection = `/* Begin XCSwiftPackageProductDependency section */
\t\t${packageProductUUID} /* HubspotMobileSDK */ = {
\t\t\tisa = XCSwiftPackageProductDependency;
\t\t\tpackage = ${packageRefUUID} /* XCRemoteSwiftPackageReference "mobile-chat-sdk-ios" */;
\t\t\tproductName = HubspotMobileSDK;
\t\t};
/* End XCSwiftPackageProductDependency section */

`;
      pbxproj = pbxproj.replace(/([\s\S]*)(rootObject\s*=)/, "$1" + productDepSection + "$2");
    }

    // Add packageReferences to project object
    if (!pbxproj.includes("packageReferences")) {
      pbxproj = pbxproj.replace(
        /(developmentRegion\s*=\s*\w+;)/,
        `$1\n\t\t\tpackageReferences = (\n\t\t\t\t${packageRefUUID} /* XCRemoteSwiftPackageReference "mobile-chat-sdk-ios" */,\n\t\t\t);`
      );
    }

    // Add packageProductDependencies to main target
    if (!pbxproj.includes("packageProductDependencies")) {
      // Find the native target with application product type
      const targetRegex = /([A-F0-9]{24})\s*\/\*[^*]*\*\/\s*=\s*\{[^}]*isa\s*=\s*PBXNativeTarget;[^}]*productType\s*=\s*"com\.apple\.product-type\.application";[^}]*\}/g;
      let match;
      
      while ((match = targetRegex.exec(pbxproj)) !== null) {
        const targetUUID = match[1];
        const targetBlock = match[0];
        
        // Check if this target already has packageProductDependencies
        if (!targetBlock.includes("packageProductDependencies")) {
          // Add after buildPhases
          pbxproj = pbxproj.replace(
            new RegExp(`(${targetUUID}[\\s\\S]*?buildPhases\\s*=\\s*\\([^)]+\\);)`, "m"),
            `$1\n\t\t\tpackageProductDependencies = (\n\t\t\t\t${packageProductUUID} /* HubspotMobileSDK */,\n\t\t\t);`
          );
          break;
        }
      }
    }

    modified = true;
    console.log("[HubspotChat] Added HubSpot SDK Swift Package to Xcode project");
  }

  if (modified) {
    fs.writeFileSync(pbxprojPath, pbxproj);
    console.log("[HubspotChat] Xcode project updated successfully");
  }
}

function getProjectName(projectRoot) {
  const configPath = path.join(projectRoot, "config.xml");
  if (fs.existsSync(configPath)) {
    const config = fs.readFileSync(configPath, "utf8");
    const nameMatch = config.match(/<name>([^<]+)<\/name>/);
    if (nameMatch) {
      return nameMatch[1];
    }
  }
  return "App";
}

function generateUUID() {
  const chars = "0123456789ABCDEF";
  let uuid = "";
  for (let i = 0; i < 24; i++) {
    uuid += chars[Math.floor(Math.random() * 16)];
  }
  return uuid;
}
