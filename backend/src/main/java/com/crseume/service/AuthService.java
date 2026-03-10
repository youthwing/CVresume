package com.crseume.service;

import com.crseume.domain.ApiModels;
import com.crseume.domain.StateModels;
import com.crseume.security.AuthUser;
import com.crseume.util.IdGenerator;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class AuthService {

    public static final String ROLE_USER = "USER";
    public static final String ROLE_ADMIN = "ADMIN";
    public static final int INVITER_BONUS_CREDITS = 50;
    public static final int INVITEE_BONUS_CREDITS = 30;

    private static final Pattern EMAIL_PATTERN =
        Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$");

    private final InMemoryStore store;
    private final PasswordEncoder passwordEncoder;
    private final VerificationMailService verificationMailService;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${app.frontend-base-url:http://localhost:3000}")
    private String frontendBaseUrl;
    @Value("${app.auth.code-expire-minutes:10}")
    private long codeExpireMinutes;
    @Value("${app.auth.code-resend-interval-seconds:60}")
    private long codeResendIntervalSeconds;
    @Value("${app.seed-users.enabled:false}")
    private boolean seedUsersEnabled;
    @Value("${app.seed-users.demo.email:demo@crseume.local}")
    private String demoUserEmail;
    @Value("${app.seed-users.demo.password:}")
    private String demoUserPassword;
    @Value("${app.seed-users.showcase.email:seed@crseume.local}")
    private String showcaseUserEmail;
    @Value("${app.seed-users.showcase.password:}")
    private String showcaseUserPassword;
    @Value("${app.seed-users.admin.email:admin@crseume.local}")
    private String adminUserEmail;
    @Value("${app.seed-users.admin.password:}")
    private String adminUserPassword;

    public AuthService(InMemoryStore store,
                       PasswordEncoder passwordEncoder,
                       VerificationMailService verificationMailService) {
        this.store = store;
        this.passwordEncoder = passwordEncoder;
        this.verificationMailService = verificationMailService;
    }

    @PostConstruct
    void init() {
        if (!seedUsersEnabled) {
            return;
        }
        ensureSeedUserIfConfigured(demoUserEmail, demoUserPassword, "陈晨", "5年+前端工程师，擅长 React / Vue / 工程化优化", "zh", 180, ROLE_USER, false);
        ensureSeedUserIfConfigured(showcaseUserEmail, showcaseUserPassword, "顾问账号", "用于生成示例广场内容", "zh", 880, ROLE_USER, false);
        ensureSeedUserIfConfigured(adminUserEmail, adminUserPassword, "系统管理员", "负责积分、用户和兑换码运营", "zh", 5000, ROLE_ADMIN, true);
    }

    private void ensureSeedUserIfConfigured(String email,
                                            String rawPassword,
                                            String displayName,
                                            String headline,
                                            String locale,
                                            int credits,
                                            String role,
                                            boolean proMember) {
        if (!StringUtils.hasText(email) || !StringUtils.hasText(rawPassword)) {
            return;
        }
        ensureSeedUser(email, rawPassword, displayName, headline, locale, credits, role, proMember);
    }

    public synchronized StateModels.UserAccount ensureSeedUser(String email,
                                                               String rawPassword,
                                                               String displayName,
                                                               String headline,
                                                               String locale,
                                                               int credits) {
        return ensureSeedUser(email, rawPassword, displayName, headline, locale, credits, ROLE_USER, false);
    }

    public synchronized StateModels.UserAccount ensureSeedUser(String email,
                                                               String rawPassword,
                                                               String displayName,
                                                               String headline,
                                                               String locale,
                                                               int credits,
                                                               String role,
                                                               boolean proMember) {
        String normalizedEmail = normalizeEmail(email);
        String existingId = store.userIdsByEmail.get(normalizedEmail);
        if (existingId != null) {
            StateModels.UserAccount existing = store.usersById.get(existingId);
            boolean changed = false;
            if (!StringUtils.hasText(existing.role)) {
                existing.role = normalizeRole(role);
                changed = true;
            }
            if (ROLE_ADMIN.equals(existing.role) && !existing.proMember) {
                existing.proMember = true;
                changed = true;
            }
            if (existing.lastLoginAt == null) {
                existing.lastLoginAt = existing.createdAt;
                changed = true;
            }
            if (changed) {
                store.persist();
            }
            return existing;
        }

        StateModels.UserAccount user = new StateModels.UserAccount();
        user.id = IdGenerator.next("usr_");
        user.email = normalizedEmail;
        user.passwordHash = passwordEncoder.encode(validatePassword(rawPassword));
        user.displayName = defaultDisplayName(displayName, normalizedEmail);
        user.headline = StringUtils.hasText(headline) ? headline.trim() : "候选人资料待完善";
        user.locale = normalizeLocale(locale);
        user.role = normalizeRole(role);
        user.proMember = proMember || ROLE_ADMIN.equals(user.role);
        user.inviteCode = generateInviteCode();
        user.credits = 0;
        user.createdAt = Instant.now();
        user.lastLoginAt = user.createdAt;
        store.usersById.put(user.id, user);
        store.userIdsByEmail.put(user.email, user.id);

        if (credits > 0) {
            adjustCredits(user.id, credits, "SYSTEM", "初始化积分", "系统种子账号初始化积分");
        } else {
            store.persist();
        }
        return user;
    }

    public synchronized ApiModels.SendCodeResponse sendCode(ApiModels.SendCodeRequest request) {
        String email = normalizeEmail(request.email());
        ensureValidEmail(email);
        String type = normalizeCodeType(request.type());
        boolean registered = store.userIdsByEmail.containsKey(email);
        if ("LOGIN".equals(type) && !registered) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "该邮箱尚未注册，请先注册");
        }
        if ("REGISTER".equals(type) && registered) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该邮箱已注册，请直接登录");
        }

        Instant now = Instant.now();
        StateModels.VerificationCodeState existingCode = store.codesByEmail.get(email);
        if (existingCode != null && existingCode.sentAt != null
            && existingCode.sentAt.plusSeconds(codeResendIntervalSeconds).isAfter(now)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "验证码发送过于频繁，请稍后再试");
        }

        String code = String.format("%06d", secureRandom.nextInt(1_000_000));
        Instant expiresAt = now.plus(Duration.ofMinutes(codeExpireMinutes));
        StateModels.VerificationCodeState verificationCode = new StateModels.VerificationCodeState();
        verificationCode.email = email;
        verificationCode.type = type;
        verificationCode.code = code;
        verificationCode.sentAt = now;
        verificationCode.expiresAt = expiresAt;

        verificationMailService.sendVerificationCode(email, code, type, request.locale(), expiresAt);

        store.codesByEmail.put(email, verificationCode);
        store.persist();
        return new ApiModels.SendCodeResponse(
            registered ? "验证码已发送，请查收邮箱" : "验证码已发送，验证后即可完成注册",
            true,
            null,
            expiresAt,
            registered
        );
    }

    public synchronized ApiModels.AuthPayload register(ApiModels.RegisterRequest request) {
        String email = normalizeEmail(request.email());
        ensureValidEmail(email);
        if (store.userIdsByEmail.containsKey(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "邮箱已注册");
        }
        verifyCode(email, request.code(), "REGISTER");

        StateModels.UserAccount user = new StateModels.UserAccount();
        user.id = IdGenerator.next("usr_");
        user.email = email;
        user.passwordHash = passwordEncoder.encode(validatePassword(request.password()));
        user.displayName = defaultDisplayName(request.displayName(), email);
        user.headline = "候选人资料待完善";
        user.locale = normalizeLocale(request.locale());
        user.role = ROLE_USER;
        user.proMember = false;
        user.inviteCode = generateInviteCode();
        user.credits = 0;
        user.createdAt = Instant.now();
        user.lastLoginAt = user.createdAt;
        store.usersById.put(user.id, user);
        store.userIdsByEmail.put(email, user.id);

        applyInviteBonus(user, request.inviteCode());
        store.codesByEmail.remove(email);
        return createAuthPayload(user);
    }

    public synchronized ApiModels.AuthPayload login(ApiModels.LoginRequest request) {
        String email = normalizeEmail(request.email());
        ensureValidEmail(email);
        StateModels.UserAccount user = requireUserByEmail(email);
        String password = validatePassword(request.password());
        if (!StringUtils.hasText(user.passwordHash) || !passwordEncoder.matches(password, user.passwordHash)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "邮箱或密码错误");
        }
        if (!ROLE_ADMIN.equals(normalizeRole(user.role))) {
            verifyCode(email, request.code(), "LOGIN");
        }
        if (StringUtils.hasText(request.locale())) {
            user.locale = normalizeLocale(request.locale());
        }
        user.lastLoginAt = Instant.now();
        if (StringUtils.hasText(request.code())) {
            store.codesByEmail.remove(email);
        }
        return createAuthPayload(user);
    }

    public synchronized ApiModels.UserProfile me(AuthUser authUser) {
        return toUserProfile(requireUser(requireAuthenticated(authUser).userId()));
    }

    public synchronized ApiModels.InvitationSummaryView invitationSummary(AuthUser authUser) {
        StateModels.UserAccount user = requireUser(requireAuthenticated(authUser).userId());
        List<StateModels.UserAccount> invitees = store.usersById.values().stream()
            .filter(item -> user.inviteCode.equals(item.referredByInviteCode))
            .sorted((left, right) -> right.createdAt.compareTo(left.createdAt))
            .toList();

        int totalEarnedCredits = store.creditHistoryByUser.getOrDefault(user.id, List.of()).stream()
            .filter(entry -> "INVITER".equals(entry.type) && entry.delta > 0)
            .mapToInt(entry -> entry.delta)
            .sum();

        return new ApiModels.InvitationSummaryView(
            user.inviteCode,
            invitees.size(),
            totalEarnedCredits,
            INVITER_BONUS_CREDITS,
            INVITEE_BONUS_CREDITS,
            invitees.stream()
                .map(item -> new ApiModels.InvitationUserView(item.id, item.displayName, item.email, item.createdAt))
                .toList()
        );
    }

    public synchronized ApiModels.UserProfile updateProfile(AuthUser authUser, ApiModels.UpdateProfileRequest request) {
        StateModels.UserAccount user = requireUser(requireAuthenticated(authUser).userId());
        if (StringUtils.hasText(request.displayName())) {
            user.displayName = request.displayName().trim();
        }
        if (StringUtils.hasText(request.headline())) {
            user.headline = request.headline().trim();
        }
        if (StringUtils.hasText(request.locale())) {
            user.locale = normalizeLocale(request.locale());
        }
        store.persist();
        return toUserProfile(user);
    }

    public List<ApiModels.OAuthProvider> listProviders() {
        return store.oauthProviders.stream()
            .map(provider -> new ApiModels.OAuthProvider(provider.providerType, provider.displayName, provider.iconUrl))
            .toList();
    }

    public synchronized ApiModels.OAuthAuthorizeResponse authorize(String providerType, String locale) {
        StateModels.OAuthProviderState provider = store.oauthProviders.stream()
            .filter(item -> item.providerType.equalsIgnoreCase(providerType))
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "OAuth provider 不存在"));

        String state = UUID.randomUUID().toString();
        store.oauthStates.put(state, provider.providerType);
        String targetLocale = normalizeLocale(locale);
        String mockCode = "mock-" + provider.providerType.toLowerCase(Locale.ROOT) + "-" + Math.abs(secureRandom.nextInt());
        String authUrl = "%s/%s/oauth/callback?provider=%s&code=%s&state=%s".formatted(
            frontendBaseUrl,
            targetLocale,
            provider.providerType,
            mockCode,
            state
        );
        store.persist();
        return new ApiModels.OAuthAuthorizeResponse(authUrl, state);
    }

    public synchronized ApiModels.AuthPayload oauthCallback(String providerType, ApiModels.OAuthCallbackRequest request) {
        String stateProvider = store.oauthStates.remove(requiredText(request.state(), "缺少 state"));
        if (stateProvider == null || !stateProvider.equalsIgnoreCase(providerType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无效的 OAuth state");
        }

        String code = requiredText(request.code(), "缺少 code");
        String email = "%s_%s@oauth.crseume.local".formatted(
            providerType.toLowerCase(Locale.ROOT),
            Math.abs(code.hashCode())
        );

        StateModels.UserAccount user = store.userIdsByEmail.containsKey(email)
            ? requireUserByEmail(email)
            : createOAuthUser(email, providerType, request.locale());
        user.lastLoginAt = Instant.now();
        return createAuthPayload(user);
    }

    public synchronized int adjustCredits(String userId, int delta, String type, String title, String description) {
        StateModels.UserAccount user = requireUser(userId);
        if (delta < 0 && user.credits + delta < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "积分不足");
        }
        user.credits += delta;
        addCreditEntry(userId, type, delta, title, description);
        store.persist();
        return user.credits;
    }

    public synchronized void activateProMembership(String userId, String title, String description) {
        StateModels.UserAccount user = requireUser(userId);
        if (user.proMember) {
            return;
        }
        user.proMember = true;
        addCreditEntry(userId, "PRO", 0, title, description);
        store.persist();
    }

    public List<ApiModels.CreditLedgerEntry> creditHistory(String userId) {
        return store.creditHistoryByUser.getOrDefault(userId, List.of()).stream()
            .sorted((left, right) -> right.createdAt.compareTo(left.createdAt))
            .map(entry -> new ApiModels.CreditLedgerEntry(
                entry.id,
                entry.type,
                entry.delta,
                entry.title,
                entry.description,
                entry.createdAt
            ))
            .toList();
    }

    public int totalConsumed(String userId) {
        return store.creditHistoryByUser.getOrDefault(userId, List.of()).stream()
            .filter(entry -> entry.delta < 0)
            .mapToInt(entry -> Math.abs(entry.delta))
            .sum();
    }

    public synchronized Optional<AuthUser> resolveAuthUser(String token) {
        StateModels.SessionToken session = store.sessionsByToken.get(token);
        if (session == null || session.expiresAt.isBefore(Instant.now())) {
            return Optional.empty();
        }
        StateModels.UserAccount user = store.usersById.get(session.userId);
        if (user == null) {
            return Optional.empty();
        }
        return Optional.of(new AuthUser(token, user.id, user.email, normalizeRole(user.role), user.proMember));
    }

    public synchronized StateModels.UserAccount requireUser(String userId) {
        StateModels.UserAccount user = store.usersById.get(userId);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "用户不存在");
        }
        if (!StringUtils.hasText(user.role)) {
            user.role = ROLE_USER;
        }
        return user;
    }

    public synchronized StateModels.UserAccount requireAdmin(AuthUser authUser) {
        StateModels.UserAccount user = requireUser(authUser.userId());
        if (!ROLE_ADMIN.equals(normalizeRole(user.role))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "需要管理员权限");
        }
        return user;
    }

    private StateModels.UserAccount requireUserByEmail(String email) {
        String userId = store.userIdsByEmail.get(email);
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "账户不存在");
        }
        return requireUser(userId);
    }

    private StateModels.UserAccount createOAuthUser(String email, String providerType, String locale) {
        StateModels.UserAccount user = new StateModels.UserAccount();
        user.id = IdGenerator.next("usr_");
        user.email = email;
        user.passwordHash = "";
        user.displayName = providerType + " 用户";
        user.headline = "通过 %s 登录的新用户".formatted(providerType);
        user.locale = normalizeLocale(locale);
        user.role = ROLE_USER;
        user.proMember = false;
        user.inviteCode = generateInviteCode();
        user.credits = 0;
        user.createdAt = Instant.now();
        user.lastLoginAt = user.createdAt;
        store.usersById.put(user.id, user);
        store.userIdsByEmail.put(user.email, user.id);
        store.persist();
        return user;
    }

    private ApiModels.AuthPayload createAuthPayload(StateModels.UserAccount user) {
        StateModels.SessionToken session = new StateModels.SessionToken();
        session.token = UUID.randomUUID().toString().replace("-", "");
        session.userId = user.id;
        session.expiresAt = Instant.now().plus(Duration.ofDays(7));
        store.sessionsByToken.put(session.token, session);
        user.lastLoginAt = Instant.now();
        store.persist();
        return new ApiModels.AuthPayload(session.token, toUserProfile(user));
    }

    private ApiModels.UserProfile toUserProfile(StateModels.UserAccount user) {
        return new ApiModels.UserProfile(
            user.id,
            user.email,
            user.displayName,
            user.headline,
            user.locale,
            normalizeRole(user.role),
            user.proMember,
            user.credits,
            user.inviteCode,
            user.createdAt,
            user.lastLoginAt
        );
    }

    private void ensureValidEmail(String email) {
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "邮箱格式不正确");
        }
    }

    private AuthUser requireAuthenticated(AuthUser authUser) {
        if (authUser == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录");
        }
        return authUser;
    }

    private void verifyCode(String email, String code, String expectedType) {
        StateModels.VerificationCodeState verificationCode = store.codesByEmail.get(email);
        if (verificationCode == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请先获取邮箱验证码");
        }
        if (verificationCode.expiresAt.isBefore(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "验证码已过期，请重新获取");
        }
        if (!verificationCode.code.equals(requiredText(code, "请输入验证码"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "验证码错误");
        }
        String savedType = normalizeCodeType(verificationCode.type);
        String targetType = normalizeCodeType(expectedType);
        if (!"AUTH".equals(savedType) && !savedType.equals(targetType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "验证码类型不匹配，请重新获取");
        }
    }

    private void applyInviteBonus(StateModels.UserAccount user, String inviteCode) {
        if (!StringUtils.hasText(inviteCode)) {
            return;
        }
        String normalizedInviteCode = inviteCode.trim().toUpperCase(Locale.ROOT);
        if (!normalizedInviteCode.startsWith("INV-")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "邀请码格式不正确");
        }
        if (normalizedInviteCode.equals(user.inviteCode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不能使用自己的邀请码");
        }
        if (StringUtils.hasText(user.referredByInviteCode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前账户已绑定邀请码");
        }

        StateModels.UserAccount inviter = store.usersById.values().stream()
            .filter(item -> normalizedInviteCode.equals(item.inviteCode))
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "邀请码不存在"));

        user.referredByInviteCode = normalizedInviteCode;
        adjustCredits(user.id, INVITEE_BONUS_CREDITS, "INVITEE", "邀请码奖励", "首次注册绑定邀请码赠送积分");
        adjustCredits(inviter.id, INVITER_BONUS_CREDITS, "INVITER", "邀请奖励", "邀请新用户注册成功赠送积分");
        store.persist();
    }

    private void addCreditEntry(String userId, String type, int delta, String title, String description) {
        List<StateModels.CreditLedgerState> history = store.creditHistoryByUser.computeIfAbsent(userId, key -> new ArrayList<>());
        StateModels.CreditLedgerState state = new StateModels.CreditLedgerState();
        state.id = IdGenerator.next("credit_");
        state.type = type;
        state.delta = delta;
        state.title = title;
        state.description = description;
        state.createdAt = Instant.now();
        history.add(state);
    }

    private String validatePassword(String password) {
        String value = requiredText(password, "请输入密码");
        if (value.length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "密码至少需要 8 位");
        }
        return value;
    }

    private String requiredText(String value, String message) {
        if (!StringUtils.hasText(value)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private String normalizeEmail(String email) {
        return requiredText(email, "请输入邮箱").toLowerCase(Locale.ROOT);
    }

    private String normalizeLocale(String locale) {
        return StringUtils.hasText(locale) && locale.trim().equalsIgnoreCase("en") ? "en" : "zh";
    }

    private String normalizeRole(String role) {
        return ROLE_ADMIN.equalsIgnoreCase(role) ? ROLE_ADMIN : ROLE_USER;
    }

    private String normalizeCodeType(String type) {
        if (!StringUtils.hasText(type)) {
            return "AUTH";
        }
        return switch (type.trim().toUpperCase(Locale.ROOT)) {
            case "LOGIN", "REGISTER", "AUTH" -> type.trim().toUpperCase(Locale.ROOT);
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "验证码类型不正确");
        };
    }

    private String defaultDisplayName(String displayName, String email) {
        if (StringUtils.hasText(displayName)) {
            return displayName.trim();
        }
        return email.substring(0, email.indexOf('@'));
    }

    private String generateInviteCode() {
        String inviteCode;
        boolean exists;
        do {
            inviteCode = "INV-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
            String candidate = inviteCode;
            exists = store.usersById.values().stream().anyMatch(user -> candidate.equals(user.inviteCode));
        } while (exists);
        return inviteCode;
    }
}
