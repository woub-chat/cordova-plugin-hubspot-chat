import Foundation
import UIKit
import SwiftUI
import HubspotMobileSDK

@objc(HubspotChatPlugin)
class HubspotChatPlugin: CDVPlugin {
    
    private var isConfigured = false
    private var configError: String?
    private var defaultChatFlowFromConfig: String?
    private var configuredPortalId: String?
    private var configuredHublet: String?
    
    override func pluginInitialize() {
        super.pluginInitialize()
        Task { @MainActor in
            self.configureSDK()
        }
    }
    
    @MainActor
    private func configureSDK() {
        guard !isConfigured else { return }
        
        do {
            let config = try loadHubspotConfig()
            defaultChatFlowFromConfig = config.defaultChatFlow
            configuredPortalId = config.portalId
            configuredHublet = config.hublet
            
            print("[HubspotChat] Configuring with:")
            print("[HubspotChat]   portalId: \(config.portalId)")
            print("[HubspotChat]   hublet: \(config.hublet)")
            print("[HubspotChat]   defaultChatFlow: \(config.defaultChatFlow ?? "nil")")
            print("[HubspotChat]   environment: \(config.environment)")
            
            HubspotManager.configure(
                portalId: config.portalId,
                hublet: config.hublet,
                defaultChatFlow: config.defaultChatFlow,
                environment: config.environment
            )
            isConfigured = true
            configError = nil
            print("[HubspotChat] SDK configured successfully (manual parameters)")
            
            // Log manager state after configuration
            let manager = HubspotManager.shared
            print("[HubspotChat] Manager state after config:")
            print("[HubspotChat]   manager.portalId: \(manager.portalId ?? "nil")")
            print("[HubspotChat]   manager.hublet: \(manager.hublet ?? "nil")")
            print("[HubspotChat]   manager.defaultChatFlow: \(manager.defaultChatFlow ?? "nil")")
            print("[HubspotChat]   manager.environment: \(manager.environment)")
            
        } catch {
            configError = error.localizedDescription
            print("[HubspotChat] Failed to configure SDK: \(error)")
        }
    }

    private func loadHubspotConfig() throws -> (portalId: String, hublet: String, defaultChatFlow: String?, environment: HubspotEnvironment) {
        let plistUrl = Bundle.main.url(forResource: "Hubspot-Info", withExtension: "plist")
            ?? Bundle.main.url(forResource: "HubSpot-Info", withExtension: "plist")

        guard
            let plistUrl,
            let plistData = try? Data(contentsOf: plistUrl),
            let raw = try PropertyListSerialization.propertyList(from: plistData, options: [], format: nil) as? [String: Any]
        else {
            throw NSError(domain: "HubspotChatPlugin", code: 1001, userInfo: [NSLocalizedDescriptionKey: "Couldn't load Hubspot-Info.plist/HubSpot-Info.plist from main bundle"])
        }
        
        print("[HubspotChat] Raw plist contents: \(raw)")

        let portalId = (raw["portalId"] as? String) ?? (raw["HubSpotPortalId"] as? String) ?? ""
        var hublet = (raw["hublet"] as? String) ?? (raw["HubSpotHubId"] as? String) ?? ""
        let defaultChatFlowRaw = (raw["defaultChatFlow"] as? String) ?? (raw["HubSpotDefaultChatFlow"] as? String)
        let defaultChatFlow = (defaultChatFlowRaw?.isEmpty == false) ? defaultChatFlowRaw : "default"
        let environmentRaw = (raw["environment"] as? String) ?? (raw["HubSpotEnvironment"] as? String) ?? "prod"

        if portalId.isEmpty {
            throw NSError(domain: "HubspotChatPlugin", code: 1002, userInfo: [NSLocalizedDescriptionKey: "Missing portalId in Hubspot-Info.plist"])
        }

        if hublet.isEmpty || hublet.allSatisfy({ $0.isNumber }) {
            hublet = "eu1"
        }

        let environment: HubspotEnvironment = (environmentRaw == "qa") ? .qa : .production
        return (portalId, hublet, defaultChatFlow, environment)
    }
    
    @objc(configure:)
    func configure(command: CDVInvokedUrlCommand) {
        Task { @MainActor in
            self.configureSDK()
            
            if self.isConfigured {
                let result = CDVPluginResult(status: .ok, messageAs: "Configured")
                self.commandDelegate.send(result, callbackId: command.callbackId)
            } else {
                let result = CDVPluginResult(status: .error, messageAs: self.configError ?? "Failed to configure")
                self.commandDelegate.send(result, callbackId: command.callbackId)
            }
        }
    }
    
    @objc(show:)
    func show(command: CDVInvokedUrlCommand) {
        Task { @MainActor in
            // Try to configure if not already
            if !self.isConfigured {
                self.configureSDK()
            }
            
            guard self.isConfigured else {
                let errorMsg = "HubSpot SDK not configured: \(self.configError ?? "unknown error")"
                print("[HubspotChat] \(errorMsg)")
                let result = CDVPluginResult(status: .error, messageAs: errorMsg)
                self.commandDelegate.send(result, callbackId: command.callbackId)
                return
            }
            
            guard let viewController = self.viewController else {
                let result = CDVPluginResult(status: .error, messageAs: "No view controller available")
                self.commandDelegate.send(result, callbackId: command.callbackId)
                return
            }
            
            var chatFlow = command.arguments.first as? String
            if chatFlow?.isEmpty ?? true {
                chatFlow = self.defaultChatFlowFromConfig
            }
            
            print("[HubspotChat] Opening chat with flow: \(chatFlow ?? "nil")")
            print("[HubspotChat] Manager state before opening:")
            let manager = HubspotManager.shared
            print("[HubspotChat]   portalId: \(manager.portalId ?? "nil")")
            print("[HubspotChat]   hublet: \(manager.hublet ?? "nil")")
            print("[HubspotChat]   defaultChatFlow: \(manager.defaultChatFlow ?? "nil")")
            print("[HubspotChat]   userIdentityToken: \(manager.userIdentityToken ?? "nil")")
            print("[HubspotChat]   userEmailAddress: \(manager.userEmailAddress ?? "nil")")
            
            let chatView: HubspotChatView
            if let flow = chatFlow, !flow.isEmpty {
                print("[HubspotChat] Creating HubspotChatView with chatFlow: \(flow)")
                chatView = HubspotChatView(chatFlow: flow)
            } else {
                print("[HubspotChat] Creating HubspotChatView without chatFlow (using SDK default)")
                chatView = HubspotChatView()
            }
            
            let hostingController = UIHostingController(rootView: chatView)
            hostingController.modalPresentationStyle = .pageSheet
            
            print("[HubspotChat] Presenting chat view controller...")
            viewController.present(hostingController, animated: true) {
                print("[HubspotChat] Chat view presented successfully")
                let result = CDVPluginResult(status: .ok)
                self.commandDelegate.send(result, callbackId: command.callbackId)
            }
        }
    }
    
    @objc(hide:)
    func hide(command: CDVInvokedUrlCommand) {
        Task { @MainActor in
            self.viewController?.dismiss(animated: true) {
                let result = CDVPluginResult(status: .ok)
                self.commandDelegate.send(result, callbackId: command.callbackId)
            }
        }
    }
    
    @objc(setUserIdentity:)
    func setUserIdentity(command: CDVInvokedUrlCommand) {
        guard command.arguments.count >= 1,
              let email = command.arguments[0] as? String, !email.isEmpty else {
            let result = CDVPluginResult(status: .error, messageAs: "Email is required")
            commandDelegate.send(result, callbackId: command.callbackId)
            return
        }
        
        let identityToken = command.arguments.count > 1 ? command.arguments[1] as? String : nil
        
        Task { @MainActor in
            print("[HubspotChat] setUserIdentity called with email: \(email), token: \(identityToken ?? "nil")")
            if let token = identityToken, !token.isEmpty {
                HubspotManager.shared.setUserIdentity(identityToken: token, email: email)
            } else {
                HubspotManager.shared.setUserIdentity(identityToken: "", email: email)
            }
            
            let result = CDVPluginResult(status: .ok)
            self.commandDelegate.send(result, callbackId: command.callbackId)
        }
    }
    
    @objc(clearUserIdentity:)
    func clearUserIdentity(command: CDVInvokedUrlCommand) {
        Task { @MainActor in
            HubspotManager.shared.clearUserData()
            
            let result = CDVPluginResult(status: .ok)
            self.commandDelegate.send(result, callbackId: command.callbackId)
        }
    }
    
    @objc(setChatProperties:)
    func setChatProperties(command: CDVInvokedUrlCommand) {
        guard command.arguments.count >= 1,
              let properties = command.arguments[0] as? [String: String] else {
            let result = CDVPluginResult(status: .error, messageAs: "Properties must be a dictionary")
            commandDelegate.send(result, callbackId: command.callbackId)
            return
        }
        
        Task { @MainActor in
            HubspotManager.shared.setChatProperties(data: properties)
            
            let result = CDVPluginResult(status: .ok)
            self.commandDelegate.send(result, callbackId: command.callbackId)
        }
    }
    
    @objc(logout:)
    func logout(command: CDVInvokedUrlCommand) {
        Task { @MainActor in
            HubspotManager.shared.clearUserData()
            
            let result = CDVPluginResult(status: .ok)
            self.commandDelegate.send(result, callbackId: command.callbackId)
        }
    }
}
