package com.crseume.api;

import com.crseume.domain.ApiModels;
import com.crseume.security.AuthUser;
import com.crseume.service.AuthService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/send-code")
    public ApiModels.SendCodeResponse sendCode(@RequestBody ApiModels.SendCodeRequest request) {
        return authService.sendCode(request);
    }

    @PostMapping("/register")
    public ApiModels.AuthPayload register(@RequestBody ApiModels.RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public ApiModels.AuthPayload login(@RequestBody ApiModels.LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/me")
    public ApiModels.UserProfile me(@AuthenticationPrincipal AuthUser authUser) {
        return authService.me(authUser);
    }

    @GetMapping("/invitations")
    public ApiModels.InvitationSummaryView invitations(@AuthenticationPrincipal AuthUser authUser) {
        return authService.invitationSummary(authUser);
    }

    @PutMapping("/profile")
    public ApiModels.UserProfile updateProfile(@AuthenticationPrincipal AuthUser authUser,
                                               @RequestBody ApiModels.UpdateProfileRequest request) {
        return authService.updateProfile(authUser, request);
    }

    @GetMapping("/oauth/providers")
    public List<ApiModels.OAuthProvider> providers() {
        return authService.listProviders();
    }

    @GetMapping("/oauth/{provider}/authorize")
    public ApiModels.OAuthAuthorizeResponse authorize(@PathVariable String provider,
                                                      @RequestParam(required = false) String locale) {
        return authService.authorize(provider, locale);
    }

    @PostMapping("/oauth/{provider}/callback")
    public ApiModels.AuthPayload callback(@PathVariable String provider,
                                          @RequestBody ApiModels.OAuthCallbackRequest request) {
        return authService.oauthCallback(provider, request);
    }
}
