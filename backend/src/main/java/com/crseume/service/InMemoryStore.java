package com.crseume.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.crseume.domain.ApiModels;
import com.crseume.domain.StateModels;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
public class InMemoryStore {

    private static final String STATE_KEY = "primary";
    private static final TypeReference<List<String>> STRING_LIST_TYPE = new TypeReference<>() {
    };

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;

    public final Map<String, StateModels.UserAccount> usersById = new ConcurrentHashMap<>();
    public final Map<String, String> userIdsByEmail = new ConcurrentHashMap<>();
    public final Map<String, StateModels.SessionToken> sessionsByToken = new ConcurrentHashMap<>();
    public final Map<String, StateModels.VerificationCodeState> codesByEmail = new ConcurrentHashMap<>();
    public final Map<String, String> oauthStates = new ConcurrentHashMap<>();

    public final List<StateModels.OAuthProviderState> oauthProviders = new CopyOnWriteArrayList<>();
    public final List<StateModels.CreditPackageState> creditPackages = new CopyOnWriteArrayList<>();
    public final List<StateModels.RedemptionProductState> redemptionProducts = new CopyOnWriteArrayList<>();

    public final Map<String, List<StateModels.CreditLedgerState>> creditHistoryByUser = new ConcurrentHashMap<>();
    public final Map<String, StateModels.ProjectState> projects = new ConcurrentHashMap<>();
    public final Map<String, StateModels.JobState> jobs = new ConcurrentHashMap<>();
    public final Map<String, StateModels.SharedResumeState> sharedResumes = new ConcurrentHashMap<>();
    public final Map<String, StateModels.OrderState> orders = new ConcurrentHashMap<>();
    public final Map<String, StateModels.RedemptionCodeState> redemptionCodes = new ConcurrentHashMap<>();
    public final Map<String, List<StateModels.FeedbackState>> feedbackByUser = new ConcurrentHashMap<>();
    public final Map<String, StateModels.ChatSessionState> chatSessions = new ConcurrentHashMap<>();
    public final Map<String, List<StateModels.ChatMessageState>> chatMessagesBySession = new ConcurrentHashMap<>();

    public InMemoryStore(JdbcTemplate jdbcTemplate,
                         ObjectMapper objectMapper,
                         PlatformTransactionManager transactionManager) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @PostConstruct
    void init() {
        ensureTables();
        boolean loadedFromRelational = loadRelationalState();
        boolean migratedFromLegacy = false;
        if (!loadedFromRelational) {
            migratedFromLegacy = loadLegacyState();
        }

        boolean changed = false;
        changed |= migrateUsers();

        if (oauthProviders.isEmpty()) {
            StateModels.OAuthProviderState gitee = new StateModels.OAuthProviderState();
            gitee.providerType = "GITEE";
            gitee.displayName = "Gitee";
            gitee.iconUrl = "";
            oauthProviders.add(gitee);
            changed = true;
        }

        changed |= ensureCommerceCatalog();
        changed |= migrateOrdersAndCodes();

        if (changed || migratedFromLegacy || !loadedFromRelational) {
            persist();
        }
    }

    @PreDestroy
    void flush() {
        persist();
    }

    public synchronized void persist() {
        transactionTemplate.executeWithoutResult(status -> {
            replaceUsers();
            replaceSessions();
            replaceVerificationCodes();
            replaceOAuthStates();
            replaceOAuthProviders();
            replaceCreditPackages();
            replaceRedemptionProducts();
            replaceCreditLedgerEntries();
            replaceProjects();
            replaceJobs();
            replaceSharedResumes();
            replaceOrders();
            replaceRedemptionCodes();
            replaceFeedback();
            replaceChatSessions();
            replaceChatMessages();
            dropLegacyStateTable();
        });
    }

    private void ensureTables() {
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS users (
              id VARCHAR(64) PRIMARY KEY,
              email VARCHAR(191) NOT NULL UNIQUE,
              password_hash VARCHAR(255) NOT NULL,
              display_name VARCHAR(255) NOT NULL,
              headline TEXT NOT NULL,
              locale VARCHAR(16) NOT NULL,
              role VARCHAR(32) NOT NULL,
              pro_member BOOLEAN NOT NULL,
              invite_code VARCHAR(64) NOT NULL UNIQUE,
              referred_by_invite_code VARCHAR(64) NULL,
              credits INT NOT NULL,
              created_at TIMESTAMP NULL,
              last_login_at TIMESTAMP NULL,
              INDEX idx_users_referred_by_invite_code (referred_by_invite_code)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS session_tokens (
              token VARCHAR(128) PRIMARY KEY,
              user_id VARCHAR(64) NOT NULL,
              expires_at TIMESTAMP NULL,
              INDEX idx_session_tokens_user_id (user_id)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS verification_codes (
              email VARCHAR(191) PRIMARY KEY,
              type VARCHAR(32) NOT NULL,
              code VARCHAR(32) NOT NULL,
              sent_at TIMESTAMP NULL,
              expires_at TIMESTAMP NULL
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS oauth_states (
              state_key VARCHAR(128) PRIMARY KEY,
              provider_type VARCHAR(64) NOT NULL
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS oauth_providers (
              provider_type VARCHAR(64) PRIMARY KEY,
              display_name VARCHAR(255) NOT NULL,
              icon_url VARCHAR(512) NOT NULL,
              sort_order INT NOT NULL
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS credit_packages (
              id VARCHAR(64) PRIMARY KEY,
              name VARCHAR(255) NOT NULL,
              description TEXT NOT NULL,
              credits INT NOT NULL,
              price_cent INT NOT NULL,
              badge VARCHAR(64) NOT NULL,
              recommended BOOLEAN NOT NULL,
              sort_order INT NOT NULL
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS redemption_products (
              id VARCHAR(64) PRIMARY KEY,
              product_type VARCHAR(64) NOT NULL,
              name VARCHAR(255) NOT NULL,
              description TEXT NOT NULL,
              credits INT NOT NULL,
              price_cent INT NOT NULL,
              grants_pro BOOLEAN NOT NULL,
              recommended BOOLEAN NOT NULL,
              active BOOLEAN NOT NULL,
              sort_order INT NOT NULL
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS credit_ledger_entries (
              id VARCHAR(64) PRIMARY KEY,
              user_id VARCHAR(64) NOT NULL,
              entry_type VARCHAR(64) NOT NULL,
              delta INT NOT NULL,
              title VARCHAR(255) NOT NULL,
              description TEXT NOT NULL,
              created_at TIMESTAMP NULL,
              INDEX idx_credit_ledger_entries_user_id (user_id),
              INDEX idx_credit_ledger_entries_created_at (created_at)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS projects (
              id VARCHAR(64) PRIMARY KEY,
              user_id VARCHAR(64) NOT NULL,
              company_name VARCHAR(255) NOT NULL,
              locale VARCHAR(16) NOT NULL,
              jd_text LONGTEXT NOT NULL,
              resume_text LONGTEXT NOT NULL,
              selected_modules_json LONGTEXT NOT NULL,
              template_id VARCHAR(128) NOT NULL,
              used_reference_image BOOLEAN NOT NULL,
              reference_image_name VARCHAR(255) NULL,
              created_at TIMESTAMP NULL,
              latest_job_id VARCHAR(64) NULL,
              INDEX idx_projects_user_id (user_id),
              INDEX idx_projects_created_at (created_at)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
              id VARCHAR(64) PRIMARY KEY,
              project_id VARCHAR(64) NOT NULL,
              user_id VARCHAR(64) NOT NULL,
              status VARCHAR(32) NOT NULL,
              progress INT NOT NULL,
              result_json LONGTEXT NULL,
              error_message TEXT NULL,
              created_at TIMESTAMP NULL,
              updated_at TIMESTAMP NULL,
              INDEX idx_jobs_project_id (project_id),
              INDEX idx_jobs_user_id (user_id),
              INDEX idx_jobs_created_at (created_at)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS shared_resumes (
              id VARCHAR(64) PRIMARY KEY,
              job_id VARCHAR(64) NOT NULL,
              user_id VARCHAR(64) NOT NULL,
              created_at TIMESTAMP NULL,
              view_count BIGINT NOT NULL,
              use_count BIGINT NOT NULL,
              INDEX idx_shared_resumes_job_id (job_id),
              INDEX idx_shared_resumes_user_id (user_id),
              INDEX idx_shared_resumes_created_at (created_at)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS orders (
              id VARCHAR(64) PRIMARY KEY,
              user_id VARCHAR(64) NOT NULL,
              product_id VARCHAR(64) NOT NULL,
              product_type VARCHAR(64) NOT NULL,
              title VARCHAR(255) NOT NULL,
              amount_cent INT NOT NULL,
              credits INT NOT NULL,
              grants_pro BOOLEAN NOT NULL,
              status VARCHAR(32) NOT NULL,
              redemption_code_id VARCHAR(64) NULL,
              created_at TIMESTAMP NULL,
              INDEX idx_orders_user_id (user_id),
              INDEX idx_orders_created_at (created_at)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """);
        ensureColumnExists("orders", "payment_method", "payment_method VARCHAR(32) NULL");
        ensureColumnExists("orders", "payer_name", "payer_name VARCHAR(255) NULL");
        ensureColumnExists("orders", "payer_account", "payer_account VARCHAR(255) NULL");
        ensureColumnExists("orders", "payment_reference", "payment_reference VARCHAR(255) NULL");
        ensureColumnExists("orders", "payment_note", "payment_note TEXT NULL");
        ensureColumnExists("orders", "review_note", "review_note TEXT NULL");
        ensureColumnExists("orders", "reviewed_by_user_id", "reviewed_by_user_id VARCHAR(64) NULL");
        ensureColumnExists("orders", "reviewed_at", "reviewed_at TIMESTAMP NULL");
        ensureColumnExists("orders", "fulfilled_at", "fulfilled_at TIMESTAMP NULL");

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS redemption_codes (
              id VARCHAR(64) PRIMARY KEY,
              code VARCHAR(128) NOT NULL UNIQUE,
              product_id VARCHAR(64) NOT NULL,
              product_type VARCHAR(64) NOT NULL,
              product_name VARCHAR(255) NOT NULL,
              credits INT NOT NULL,
              grants_pro BOOLEAN NOT NULL,
              status VARCHAR(32) NOT NULL,
              created_at TIMESTAMP NULL,
              purchased_by_user_id VARCHAR(64) NULL,
              redeemed_by_user_id VARCHAR(64) NULL,
              redeemed_at TIMESTAMP NULL,
              order_id VARCHAR(64) NULL,
              INDEX idx_redemption_codes_product_id (product_id),
              INDEX idx_redemption_codes_purchased_by_user_id (purchased_by_user_id),
              INDEX idx_redemption_codes_redeemed_by_user_id (redeemed_by_user_id),
              INDEX idx_redemption_codes_created_at (created_at)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS feedback_entries (
              id VARCHAR(64) PRIMARY KEY,
              user_id VARCHAR(64) NOT NULL,
              category VARCHAR(64) NOT NULL,
              content LONGTEXT NOT NULL,
              created_at TIMESTAMP NULL,
              INDEX idx_feedback_entries_user_id (user_id),
              INDEX idx_feedback_entries_created_at (created_at)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
              id VARCHAR(64) PRIMARY KEY,
              user_id VARCHAR(64) NOT NULL,
              title VARCHAR(255) NOT NULL,
              status VARCHAR(32) NOT NULL,
              created_at TIMESTAMP NULL,
              updated_at TIMESTAMP NULL,
              INDEX idx_chat_sessions_user_id (user_id),
              INDEX idx_chat_sessions_updated_at (updated_at)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """);

        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
              id VARCHAR(64) PRIMARY KEY,
              session_id VARCHAR(64) NOT NULL,
              role VARCHAR(32) NOT NULL,
              content LONGTEXT NOT NULL,
              created_at TIMESTAMP NULL,
              INDEX idx_chat_messages_session_id (session_id),
              INDEX idx_chat_messages_created_at (created_at)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """);
    }

    private boolean loadRelationalState() {
        if (!hasRelationalState()) {
            return false;
        }

        clearState();
        loadUsers();
        loadSessions();
        loadVerificationCodes();
        loadOAuthStates();
        loadOAuthProviders();
        loadCreditPackages();
        loadRedemptionProducts();
        loadCreditLedgerEntries();
        loadProjects();
        loadJobs();
        loadSharedResumes();
        loadOrders();
        loadRedemptionCodes();
        loadFeedback();
        loadChatSessions();
        loadChatMessages();
        return true;
    }

    private boolean loadLegacyState() {
        if (!legacyStateTableExists()) {
            return false;
        }
        List<String> payloads = jdbcTemplate.query(
            "SELECT payload FROM app_state WHERE state_key = ?",
            (resultSet, rowNum) -> resultSet.getString("payload"),
            STATE_KEY
        );
        if (payloads.isEmpty()) {
            return false;
        }

        try {
            StoreSnapshot snapshot = objectMapper.readValue(payloads.getFirst(), StoreSnapshot.class);
            restore(snapshot);
            return true;
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to load legacy application state from MySQL", exception);
        }
    }

    private boolean hasRelationalState() {
        return tableHasRows("users")
            || tableHasRows("oauth_providers")
            || tableHasRows("redemption_products")
            || tableHasRows("projects")
            || tableHasRows("orders")
            || tableHasRows("redemption_codes")
            || tableHasRows("chat_sessions");
    }

    private boolean tableHasRows(String tableName) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + tableName, Integer.class);
        return count != null && count > 0;
    }

    private void ensureColumnExists(String tableName, String columnName, String definition) {
        Integer count = jdbcTemplate.queryForObject(
            """
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
                """,
            Integer.class,
            tableName,
            columnName
        );
        if (count == null || count == 0) {
            jdbcTemplate.execute("ALTER TABLE " + tableName + " ADD COLUMN " + definition);
        }
    }

    private boolean legacyStateTableExists() {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'app_state'",
            Integer.class
        );
        return count != null && count > 0;
    }

    private void dropLegacyStateTable() {
        if (legacyStateTableExists()) {
            jdbcTemplate.execute("DROP TABLE app_state");
        }
    }

    private void clearState() {
        usersById.clear();
        userIdsByEmail.clear();
        sessionsByToken.clear();
        codesByEmail.clear();
        oauthStates.clear();
        oauthProviders.clear();
        creditPackages.clear();
        redemptionProducts.clear();
        creditHistoryByUser.clear();
        projects.clear();
        jobs.clear();
        sharedResumes.clear();
        orders.clear();
        redemptionCodes.clear();
        feedbackByUser.clear();
        chatSessions.clear();
        chatMessagesBySession.clear();
    }

    private void loadUsers() {
        jdbcTemplate.query("""
            SELECT id, email, password_hash, display_name, headline, locale, role, pro_member,
                   invite_code, referred_by_invite_code, credits, created_at, last_login_at
            FROM users
            """, resultSet -> {
            StateModels.UserAccount user = new StateModels.UserAccount();
            user.id = resultSet.getString("id");
            user.email = resultSet.getString("email");
            user.passwordHash = resultSet.getString("password_hash");
            user.displayName = resultSet.getString("display_name");
            user.headline = resultSet.getString("headline");
            user.locale = resultSet.getString("locale");
            user.role = resultSet.getString("role");
            user.proMember = resultSet.getBoolean("pro_member");
            user.inviteCode = resultSet.getString("invite_code");
            user.referredByInviteCode = resultSet.getString("referred_by_invite_code");
            user.credits = resultSet.getInt("credits");
            user.createdAt = toInstant(resultSet, "created_at");
            user.lastLoginAt = toInstant(resultSet, "last_login_at");
            usersById.put(user.id, user);
            userIdsByEmail.put(user.email, user.id);
        });
    }

    private void loadSessions() {
        jdbcTemplate.query("SELECT token, user_id, expires_at FROM session_tokens", resultSet -> {
            StateModels.SessionToken session = new StateModels.SessionToken();
            session.token = resultSet.getString("token");
            session.userId = resultSet.getString("user_id");
            session.expiresAt = toInstant(resultSet, "expires_at");
            sessionsByToken.put(session.token, session);
        });
    }

    private void loadVerificationCodes() {
        jdbcTemplate.query("SELECT email, type, code, sent_at, expires_at FROM verification_codes", resultSet -> {
            StateModels.VerificationCodeState code = new StateModels.VerificationCodeState();
            code.email = resultSet.getString("email");
            code.type = resultSet.getString("type");
            code.code = resultSet.getString("code");
            code.sentAt = toInstant(resultSet, "sent_at");
            code.expiresAt = toInstant(resultSet, "expires_at");
            codesByEmail.put(code.email, code);
        });
    }

    private void loadOAuthStates() {
        jdbcTemplate.query("SELECT state_key, provider_type FROM oauth_states", (RowCallbackHandler) resultSet ->
            oauthStates.put(resultSet.getString("state_key"), resultSet.getString("provider_type"))
        );
    }

    private void loadOAuthProviders() {
        jdbcTemplate.query("""
            SELECT provider_type, display_name, icon_url
            FROM oauth_providers
            ORDER BY sort_order ASC, provider_type ASC
            """, resultSet -> {
            StateModels.OAuthProviderState provider = new StateModels.OAuthProviderState();
            provider.providerType = resultSet.getString("provider_type");
            provider.displayName = resultSet.getString("display_name");
            provider.iconUrl = resultSet.getString("icon_url");
            oauthProviders.add(provider);
        });
    }

    private void loadCreditPackages() {
        jdbcTemplate.query("""
            SELECT id, name, description, credits, price_cent, badge, recommended
            FROM credit_packages
            ORDER BY sort_order ASC, id ASC
            """, resultSet -> {
            StateModels.CreditPackageState state = new StateModels.CreditPackageState();
            state.id = resultSet.getString("id");
            state.name = resultSet.getString("name");
            state.description = resultSet.getString("description");
            state.credits = resultSet.getInt("credits");
            state.priceCent = resultSet.getInt("price_cent");
            state.badge = resultSet.getString("badge");
            state.recommended = resultSet.getBoolean("recommended");
            creditPackages.add(state);
        });
    }

    private void loadRedemptionProducts() {
        jdbcTemplate.query("""
            SELECT id, product_type, name, description, credits, price_cent, grants_pro, recommended, active
            FROM redemption_products
            ORDER BY sort_order ASC, id ASC
            """, resultSet -> {
            StateModels.RedemptionProductState state = new StateModels.RedemptionProductState();
            state.id = resultSet.getString("id");
            state.productType = resultSet.getString("product_type");
            state.name = resultSet.getString("name");
            state.description = resultSet.getString("description");
            state.credits = resultSet.getInt("credits");
            state.priceCent = resultSet.getInt("price_cent");
            state.grantsPro = resultSet.getBoolean("grants_pro");
            state.recommended = resultSet.getBoolean("recommended");
            state.active = resultSet.getBoolean("active");
            redemptionProducts.add(state);
        });
    }

    private void loadCreditLedgerEntries() {
        jdbcTemplate.query("""
            SELECT id, user_id, entry_type, delta, title, description, created_at
            FROM credit_ledger_entries
            ORDER BY created_at ASC, id ASC
            """, resultSet -> {
            StateModels.CreditLedgerState state = new StateModels.CreditLedgerState();
            state.id = resultSet.getString("id");
            state.type = resultSet.getString("entry_type");
            state.delta = resultSet.getInt("delta");
            state.title = resultSet.getString("title");
            state.description = resultSet.getString("description");
            state.createdAt = toInstant(resultSet, "created_at");
            creditHistoryByUser.computeIfAbsent(resultSet.getString("user_id"), ignored -> new ArrayList<>()).add(state);
        });
    }

    private void loadProjects() {
        jdbcTemplate.query("""
            SELECT id, user_id, company_name, locale, jd_text, resume_text, selected_modules_json,
                   template_id, used_reference_image, reference_image_name, created_at, latest_job_id
            FROM projects
            """, resultSet -> {
            StateModels.ProjectState state = new StateModels.ProjectState();
            state.id = resultSet.getString("id");
            state.userId = resultSet.getString("user_id");
            state.companyName = resultSet.getString("company_name");
            state.locale = resultSet.getString("locale");
            state.jdText = resultSet.getString("jd_text");
            state.resumeText = resultSet.getString("resume_text");
            state.selectedModules = readJsonList(resultSet.getString("selected_modules_json"));
            state.templateId = resultSet.getString("template_id");
            state.usedReferenceImage = resultSet.getBoolean("used_reference_image");
            state.referenceImageName = resultSet.getString("reference_image_name");
            state.createdAt = toInstant(resultSet, "created_at");
            state.latestJobId = resultSet.getString("latest_job_id");
            projects.put(state.id, state);
        });
    }

    private void loadJobs() {
        jdbcTemplate.query("""
            SELECT id, project_id, user_id, status, progress, result_json, error_message, created_at, updated_at
            FROM jobs
            """, resultSet -> {
            StateModels.JobState state = new StateModels.JobState();
            state.id = resultSet.getString("id");
            state.projectId = resultSet.getString("project_id");
            state.userId = resultSet.getString("user_id");
            state.status = resultSet.getString("status");
            state.progress = resultSet.getInt("progress");
            state.result = readJson(resultSet.getString("result_json"), ApiModels.ResumeResult.class);
            state.errorMessage = resultSet.getString("error_message");
            state.createdAt = toInstant(resultSet, "created_at");
            state.updatedAt = toInstant(resultSet, "updated_at");
            jobs.put(state.id, state);
        });
    }

    private void loadSharedResumes() {
        jdbcTemplate.query("""
            SELECT id, job_id, user_id, created_at, view_count, use_count
            FROM shared_resumes
            """, resultSet -> {
            StateModels.SharedResumeState state = new StateModels.SharedResumeState();
            state.id = resultSet.getString("id");
            state.jobId = resultSet.getString("job_id");
            state.userId = resultSet.getString("user_id");
            state.createdAt = toInstant(resultSet, "created_at");
            state.viewCount = resultSet.getLong("view_count");
            state.useCount = resultSet.getLong("use_count");
            sharedResumes.put(state.id, state);
        });
    }

    private void loadOrders() {
        jdbcTemplate.query("""
            SELECT id, user_id, product_id, product_type, title, amount_cent, credits, grants_pro, status,
                   payment_method, payer_name, payer_account, payment_reference, payment_note, review_note,
                   reviewed_by_user_id, reviewed_at, fulfilled_at, redemption_code_id, created_at
            FROM orders
            """, resultSet -> {
            StateModels.OrderState state = new StateModels.OrderState();
            state.id = resultSet.getString("id");
            state.userId = resultSet.getString("user_id");
            state.productId = resultSet.getString("product_id");
            state.productType = resultSet.getString("product_type");
            state.title = resultSet.getString("title");
            state.amountCent = resultSet.getInt("amount_cent");
            state.credits = resultSet.getInt("credits");
            state.grantsPro = resultSet.getBoolean("grants_pro");
            state.status = resultSet.getString("status");
            state.paymentMethod = resultSet.getString("payment_method");
            state.payerName = resultSet.getString("payer_name");
            state.payerAccount = resultSet.getString("payer_account");
            state.paymentReference = resultSet.getString("payment_reference");
            state.paymentNote = resultSet.getString("payment_note");
            state.reviewNote = resultSet.getString("review_note");
            state.reviewedByUserId = resultSet.getString("reviewed_by_user_id");
            state.reviewedAt = toInstant(resultSet, "reviewed_at");
            state.fulfilledAt = toInstant(resultSet, "fulfilled_at");
            state.redemptionCodeId = resultSet.getString("redemption_code_id");
            state.createdAt = toInstant(resultSet, "created_at");
            orders.put(state.id, state);
        });
    }

    private void loadRedemptionCodes() {
        jdbcTemplate.query("""
            SELECT id, code, product_id, product_type, product_name, credits, grants_pro, status, created_at,
                   purchased_by_user_id, redeemed_by_user_id, redeemed_at, order_id
            FROM redemption_codes
            """, resultSet -> {
            StateModels.RedemptionCodeState state = new StateModels.RedemptionCodeState();
            state.id = resultSet.getString("id");
            state.code = resultSet.getString("code");
            state.productId = resultSet.getString("product_id");
            state.productType = resultSet.getString("product_type");
            state.productName = resultSet.getString("product_name");
            state.credits = resultSet.getInt("credits");
            state.grantsPro = resultSet.getBoolean("grants_pro");
            state.status = resultSet.getString("status");
            state.createdAt = toInstant(resultSet, "created_at");
            state.purchasedByUserId = resultSet.getString("purchased_by_user_id");
            state.redeemedByUserId = resultSet.getString("redeemed_by_user_id");
            state.redeemedAt = toInstant(resultSet, "redeemed_at");
            state.orderId = resultSet.getString("order_id");
            redemptionCodes.put(state.id, state);
        });
    }

    private void loadFeedback() {
        jdbcTemplate.query("""
            SELECT id, user_id, category, content, created_at
            FROM feedback_entries
            ORDER BY created_at ASC, id ASC
            """, resultSet -> {
            StateModels.FeedbackState state = new StateModels.FeedbackState();
            state.id = resultSet.getString("id");
            state.userId = resultSet.getString("user_id");
            state.category = resultSet.getString("category");
            state.content = resultSet.getString("content");
            state.createdAt = toInstant(resultSet, "created_at");
            feedbackByUser.computeIfAbsent(state.userId, ignored -> new ArrayList<>()).add(state);
        });
    }

    private void loadChatSessions() {
        jdbcTemplate.query("""
            SELECT id, user_id, title, status, created_at, updated_at
            FROM chat_sessions
            """, resultSet -> {
            StateModels.ChatSessionState state = new StateModels.ChatSessionState();
            state.id = resultSet.getString("id");
            state.userId = resultSet.getString("user_id");
            state.title = resultSet.getString("title");
            state.status = resultSet.getString("status");
            state.createdAt = toInstant(resultSet, "created_at");
            state.updatedAt = toInstant(resultSet, "updated_at");
            chatSessions.put(state.id, state);
        });
    }

    private void loadChatMessages() {
        jdbcTemplate.query("""
            SELECT id, session_id, role, content, created_at
            FROM chat_messages
            ORDER BY created_at ASC, id ASC
            """, resultSet -> {
            StateModels.ChatMessageState state = new StateModels.ChatMessageState();
            state.id = resultSet.getString("id");
            state.sessionId = resultSet.getString("session_id");
            state.role = resultSet.getString("role");
            state.content = resultSet.getString("content");
            state.createdAt = toInstant(resultSet, "created_at");
            chatMessagesBySession.computeIfAbsent(state.sessionId, ignored -> new ArrayList<>()).add(state);
        });
    }

    private void replaceUsers() {
        jdbcTemplate.update("DELETE FROM users");
        for (StateModels.UserAccount user : usersById.values()) {
            jdbcTemplate.update("""
                INSERT INTO users (
                  id, email, password_hash, display_name, headline, locale, role, pro_member,
                  invite_code, referred_by_invite_code, credits, created_at, last_login_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                user.id,
                user.email,
                defaultString(user.passwordHash),
                defaultString(user.displayName),
                defaultString(user.headline),
                defaultString(user.locale),
                defaultString(user.role),
                user.proMember,
                defaultString(user.inviteCode),
                nullableString(user.referredByInviteCode),
                user.credits,
                toTimestamp(user.createdAt),
                toTimestamp(user.lastLoginAt)
            );
        }
    }

    private void replaceSessions() {
        jdbcTemplate.update("DELETE FROM session_tokens");
        for (StateModels.SessionToken session : sessionsByToken.values()) {
            jdbcTemplate.update(
                "INSERT INTO session_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
                session.token,
                session.userId,
                toTimestamp(session.expiresAt)
            );
        }
    }

    private void replaceVerificationCodes() {
        jdbcTemplate.update("DELETE FROM verification_codes");
        for (StateModels.VerificationCodeState code : codesByEmail.values()) {
            jdbcTemplate.update("""
                INSERT INTO verification_codes (email, type, code, sent_at, expires_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                code.email,
                defaultString(code.type),
                defaultString(code.code),
                toTimestamp(code.sentAt),
                toTimestamp(code.expiresAt)
            );
        }
    }

    private void replaceOAuthStates() {
        jdbcTemplate.update("DELETE FROM oauth_states");
        for (Map.Entry<String, String> entry : oauthStates.entrySet()) {
            jdbcTemplate.update(
                "INSERT INTO oauth_states (state_key, provider_type) VALUES (?, ?)",
                entry.getKey(),
                entry.getValue()
            );
        }
    }

    private void replaceOAuthProviders() {
        jdbcTemplate.update("DELETE FROM oauth_providers");
        for (int index = 0; index < oauthProviders.size(); index += 1) {
            StateModels.OAuthProviderState provider = oauthProviders.get(index);
            jdbcTemplate.update("""
                INSERT INTO oauth_providers (provider_type, display_name, icon_url, sort_order)
                VALUES (?, ?, ?, ?)
                """,
                provider.providerType,
                defaultString(provider.displayName),
                defaultString(provider.iconUrl),
                index
            );
        }
    }

    private void replaceCreditPackages() {
        jdbcTemplate.update("DELETE FROM credit_packages");
        for (int index = 0; index < creditPackages.size(); index += 1) {
            StateModels.CreditPackageState state = creditPackages.get(index);
            jdbcTemplate.update("""
                INSERT INTO credit_packages (id, name, description, credits, price_cent, badge, recommended, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                state.id,
                defaultString(state.name),
                defaultString(state.description),
                state.credits,
                state.priceCent,
                defaultString(state.badge),
                state.recommended,
                index
            );
        }
    }

    private void replaceRedemptionProducts() {
        jdbcTemplate.update("DELETE FROM redemption_products");
        for (int index = 0; index < redemptionProducts.size(); index += 1) {
            StateModels.RedemptionProductState state = redemptionProducts.get(index);
            jdbcTemplate.update("""
                INSERT INTO redemption_products (
                  id, product_type, name, description, credits, price_cent, grants_pro, recommended, active, sort_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                state.id,
                defaultString(state.productType),
                defaultString(state.name),
                defaultString(state.description),
                state.credits,
                state.priceCent,
                state.grantsPro,
                state.recommended,
                state.active,
                index
            );
        }
    }

    private void replaceCreditLedgerEntries() {
        jdbcTemplate.update("DELETE FROM credit_ledger_entries");
        for (Map.Entry<String, List<StateModels.CreditLedgerState>> entry : creditHistoryByUser.entrySet()) {
            for (StateModels.CreditLedgerState state : entry.getValue()) {
                jdbcTemplate.update("""
                    INSERT INTO credit_ledger_entries (id, user_id, entry_type, delta, title, description, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    state.id,
                    entry.getKey(),
                    defaultString(state.type),
                    state.delta,
                    defaultString(state.title),
                    defaultString(state.description),
                    toTimestamp(state.createdAt)
                );
            }
        }
    }

    private void replaceProjects() {
        jdbcTemplate.update("DELETE FROM projects");
        for (StateModels.ProjectState state : projects.values()) {
            jdbcTemplate.update("""
                INSERT INTO projects (
                  id, user_id, company_name, locale, jd_text, resume_text, selected_modules_json, template_id,
                  used_reference_image, reference_image_name, created_at, latest_job_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                state.id,
                state.userId,
                defaultString(state.companyName),
                defaultString(state.locale),
                defaultString(state.jdText),
                defaultString(state.resumeText),
                writeJson(state.selectedModules),
                defaultString(state.templateId),
                state.usedReferenceImage,
                nullableString(state.referenceImageName),
                toTimestamp(state.createdAt),
                nullableString(state.latestJobId)
            );
        }
    }

    private void replaceJobs() {
        jdbcTemplate.update("DELETE FROM jobs");
        for (StateModels.JobState state : jobs.values()) {
            jdbcTemplate.update("""
                INSERT INTO jobs (
                  id, project_id, user_id, status, progress, result_json, error_message, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                state.id,
                state.projectId,
                state.userId,
                defaultString(state.status),
                state.progress,
                nullableJson(state.result),
                nullableString(state.errorMessage),
                toTimestamp(state.createdAt),
                toTimestamp(state.updatedAt)
            );
        }
    }

    private void replaceSharedResumes() {
        jdbcTemplate.update("DELETE FROM shared_resumes");
        for (StateModels.SharedResumeState state : sharedResumes.values()) {
            jdbcTemplate.update("""
                INSERT INTO shared_resumes (id, job_id, user_id, created_at, view_count, use_count)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                state.id,
                state.jobId,
                state.userId,
                toTimestamp(state.createdAt),
                state.viewCount,
                state.useCount
            );
        }
    }

    private void replaceOrders() {
        jdbcTemplate.update("DELETE FROM orders");
        for (StateModels.OrderState state : orders.values()) {
            jdbcTemplate.update("""
                INSERT INTO orders (
                  id, user_id, product_id, product_type, title, amount_cent, credits, grants_pro, status,
                  payment_method, payer_name, payer_account, payment_reference, payment_note, review_note,
                  reviewed_by_user_id, reviewed_at, fulfilled_at, redemption_code_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                state.id,
                state.userId,
                defaultString(state.productId),
                defaultString(state.productType),
                defaultString(state.title),
                state.amountCent,
                state.credits,
                state.grantsPro,
                defaultString(state.status),
                nullableString(state.paymentMethod),
                nullableString(state.payerName),
                nullableString(state.payerAccount),
                nullableString(state.paymentReference),
                nullableString(state.paymentNote),
                nullableString(state.reviewNote),
                nullableString(state.reviewedByUserId),
                toTimestamp(state.reviewedAt),
                toTimestamp(state.fulfilledAt),
                nullableString(state.redemptionCodeId),
                toTimestamp(state.createdAt)
            );
        }
    }

    private void replaceRedemptionCodes() {
        jdbcTemplate.update("DELETE FROM redemption_codes");
        for (StateModels.RedemptionCodeState state : redemptionCodes.values()) {
            jdbcTemplate.update("""
                INSERT INTO redemption_codes (
                  id, code, product_id, product_type, product_name, credits, grants_pro, status, created_at,
                  purchased_by_user_id, redeemed_by_user_id, redeemed_at, order_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                state.id,
                defaultString(state.code),
                defaultString(state.productId),
                defaultString(state.productType),
                defaultString(state.productName),
                state.credits,
                state.grantsPro,
                defaultString(state.status),
                toTimestamp(state.createdAt),
                nullableString(state.purchasedByUserId),
                nullableString(state.redeemedByUserId),
                toTimestamp(state.redeemedAt),
                nullableString(state.orderId)
            );
        }
    }

    private void replaceFeedback() {
        jdbcTemplate.update("DELETE FROM feedback_entries");
        for (Map.Entry<String, List<StateModels.FeedbackState>> entry : feedbackByUser.entrySet()) {
            for (StateModels.FeedbackState state : entry.getValue()) {
                jdbcTemplate.update("""
                    INSERT INTO feedback_entries (id, user_id, category, content, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    state.id,
                    entry.getKey(),
                    defaultString(state.category),
                    defaultString(state.content),
                    toTimestamp(state.createdAt)
                );
            }
        }
    }

    private void replaceChatSessions() {
        jdbcTemplate.update("DELETE FROM chat_sessions");
        for (StateModels.ChatSessionState state : chatSessions.values()) {
            jdbcTemplate.update("""
                INSERT INTO chat_sessions (id, user_id, title, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                state.id,
                state.userId,
                defaultString(state.title),
                defaultString(state.status),
                toTimestamp(state.createdAt),
                toTimestamp(state.updatedAt)
            );
        }
    }

    private void replaceChatMessages() {
        jdbcTemplate.update("DELETE FROM chat_messages");
        for (Map.Entry<String, List<StateModels.ChatMessageState>> entry : chatMessagesBySession.entrySet()) {
            for (StateModels.ChatMessageState state : entry.getValue()) {
                jdbcTemplate.update("""
                    INSERT INTO chat_messages (id, session_id, role, content, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    state.id,
                    entry.getKey(),
                    defaultString(state.role),
                    defaultString(state.content),
                    toTimestamp(state.createdAt)
                );
            }
        }
    }

    private StateModels.CreditPackageState creditPackage(String id,
                                                         String name,
                                                         String description,
                                                         int credits,
                                                         int priceCent,
                                                         String badge,
                                                         boolean recommended) {
        StateModels.CreditPackageState state = new StateModels.CreditPackageState();
        state.id = id;
        state.name = name;
        state.description = description;
        state.credits = credits;
        state.priceCent = priceCent;
        state.badge = badge;
        state.recommended = recommended;
        return state;
    }

    private StateModels.RedemptionProductState redemptionProduct(String id,
                                                                 String productType,
                                                                 String name,
                                                                 String description,
                                                                 int credits,
                                                                 int priceCent,
                                                                 boolean grantsPro,
                                                                 boolean recommended,
                                                                 boolean active) {
        StateModels.RedemptionProductState state = new StateModels.RedemptionProductState();
        state.id = id;
        state.productType = productType;
        state.name = name;
        state.description = description;
        state.credits = credits;
        state.priceCent = priceCent;
        state.grantsPro = grantsPro;
        state.recommended = recommended;
        state.active = active;
        return state;
    }

    private boolean migrateUsers() {
        boolean changed = false;
        for (StateModels.UserAccount user : usersById.values()) {
            if (user.role == null || user.role.isBlank()) {
                user.role = "USER";
                changed = true;
            }
            if (user.lastLoginAt == null && user.createdAt != null) {
                user.lastLoginAt = user.createdAt;
                changed = true;
            }
            if ("ADMIN".equalsIgnoreCase(user.role)) {
                user.role = "ADMIN";
                if (!user.proMember) {
                    user.proMember = true;
                    changed = true;
                }
            }
        }
        return changed;
    }

    private boolean ensureCommerceCatalog() {
        List<StateModels.RedemptionProductState> targetProducts = List.of(
            redemptionProduct("pro-plan", "PRO_PLAN", "专业版礼包兑换码", "购买后获得专业版身份，并可兑换 690 积分。", 690, 6900, true, true, true),
            redemptionProduct("points-100", "POINTS", "100 积分兑换码", "适合单次或少量生成场景。", 100, 1000, false, false, true),
            redemptionProduct("points-300", "POINTS", "300 积分兑换码", "高频投递阶段的标准积分包。", 300, 3000, false, true, true),
            redemptionProduct("points-1000", "POINTS", "1000 积分兑换码", "密集求职或团队分发场景。", 1000, 10000, false, false, true)
        );

        boolean needsReset = redemptionProducts.isEmpty()
            || redemptionProducts.stream().noneMatch(item -> "pro-plan".equals(item.id))
            || redemptionProducts.stream().noneMatch(item -> "points-100".equals(item.id));

        if (!needsReset) {
            syncCreditPackagesFromProducts();
            return false;
        }

        redemptionProducts.clear();
        redemptionProducts.addAll(targetProducts);
        syncCreditPackagesFromProducts();
        return true;
    }

    private void syncCreditPackagesFromProducts() {
        creditPackages.clear();
        redemptionProducts.stream()
            .filter(item -> "POINTS".equals(item.productType) && item.active)
            .forEach(item -> creditPackages.add(creditPackage(
                item.id,
                item.name,
                item.description,
                item.credits,
                item.priceCent,
                item.recommended ? "推荐" : "积分码",
                item.recommended
            )));
    }

    private boolean migrateOrdersAndCodes() {
        boolean changed = false;
        for (StateModels.OrderState order : orders.values()) {
            if (order.productId == null || order.productId.isBlank()) {
                if ("PRO".equalsIgnoreCase(order.productType)) {
                    order.productId = "pro-plan";
                    order.productType = "PRO_PLAN";
                    order.credits = 690;
                    order.grantsPro = true;
                    changed = true;
                } else if ("SEASON".equalsIgnoreCase(order.productType) || "CREDIT_PACKAGE".equalsIgnoreCase(order.productType)) {
                    order.productType = "POINTS";
                    if (order.credits <= 0) {
                        order.credits = Math.max(order.amountCent / 10, 0);
                    }
                    changed = true;
                }
            }
        }

        for (StateModels.RedemptionCodeState code : redemptionCodes.values()) {
            StateModels.RedemptionProductState product = redemptionProducts.stream()
                .filter(item -> item.id.equals(code.productId))
                .findFirst()
                .orElse(null);
            if ((code.productType == null || code.productType.isBlank()) && product != null) {
                code.productType = product.productType;
                changed = true;
            }
            if (!code.grantsPro && product != null && product.grantsPro) {
                code.grantsPro = true;
                changed = true;
            }
            if (code.credits <= 0 && product != null) {
                code.credits = product.credits;
                changed = true;
            }
            if (code.status == null || code.status.isBlank() || "AVAILABLE".equalsIgnoreCase(code.status)) {
                if (code.redeemedByUserId != null && !code.redeemedByUserId.isBlank()) {
                    code.status = "REDEEMED";
                } else if (code.purchasedByUserId != null && !code.purchasedByUserId.isBlank()) {
                    code.status = "PURCHASED";
                } else {
                    code.status = "AVAILABLE";
                }
                changed = true;
            }
            if (code.createdAt == null) {
                code.createdAt = Instant.now();
                changed = true;
            }
        }
        return changed;
    }

    private void restore(StoreSnapshot snapshot) {
        clearState();
        usersById.putAll(snapshot.usersById);
        if (snapshot.userIdsByEmail.isEmpty()) {
            snapshot.usersById.values().forEach(user -> userIdsByEmail.put(user.email, user.id));
        } else {
            userIdsByEmail.putAll(snapshot.userIdsByEmail);
        }
        sessionsByToken.putAll(snapshot.sessionsByToken);
        codesByEmail.putAll(snapshot.codesByEmail);
        oauthStates.putAll(snapshot.oauthStates);
        oauthProviders.addAll(snapshot.oauthProviders);
        creditPackages.addAll(snapshot.creditPackages);
        redemptionProducts.addAll(snapshot.redemptionProducts);
        creditHistoryByUser.putAll(snapshot.creditHistoryByUser);
        projects.putAll(snapshot.projects);
        jobs.putAll(snapshot.jobs);
        sharedResumes.putAll(snapshot.sharedResumes);
        orders.putAll(snapshot.orders);
        redemptionCodes.putAll(snapshot.redemptionCodes);
        feedbackByUser.putAll(snapshot.feedbackByUser);
        chatSessions.putAll(snapshot.chatSessions);
        chatMessagesBySession.putAll(snapshot.chatMessagesBySession);
    }

    private List<String> readJsonList(String value) {
        if (value == null || value.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return new ArrayList<>(objectMapper.readValue(value, STRING_LIST_TYPE));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to deserialize JSON list", exception);
        }
    }

    private <T> T readJson(String value, Class<T> type) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(value, type);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to deserialize JSON payload", exception);
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize JSON payload", exception);
        }
    }

    private String nullableJson(Object value) {
        return value == null ? null : writeJson(value);
    }

    private Timestamp toTimestamp(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    private Instant toInstant(ResultSet resultSet, String columnLabel) throws SQLException {
        Timestamp timestamp = resultSet.getTimestamp(columnLabel);
        return timestamp == null ? null : timestamp.toInstant();
    }

    private String defaultString(String value) {
        return value == null ? "" : value;
    }

    private String nullableString(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static final class StoreSnapshot {
        public Map<String, StateModels.UserAccount> usersById = new ConcurrentHashMap<>();
        public Map<String, String> userIdsByEmail = new ConcurrentHashMap<>();
        public Map<String, StateModels.SessionToken> sessionsByToken = new ConcurrentHashMap<>();
        public Map<String, StateModels.VerificationCodeState> codesByEmail = new ConcurrentHashMap<>();
        public Map<String, String> oauthStates = new ConcurrentHashMap<>();
        public List<StateModels.OAuthProviderState> oauthProviders = new ArrayList<>();
        public List<StateModels.CreditPackageState> creditPackages = new ArrayList<>();
        public List<StateModels.RedemptionProductState> redemptionProducts = new ArrayList<>();
        public Map<String, List<StateModels.CreditLedgerState>> creditHistoryByUser = new ConcurrentHashMap<>();
        public Map<String, StateModels.ProjectState> projects = new ConcurrentHashMap<>();
        public Map<String, StateModels.JobState> jobs = new ConcurrentHashMap<>();
        public Map<String, StateModels.SharedResumeState> sharedResumes = new ConcurrentHashMap<>();
        public Map<String, StateModels.OrderState> orders = new ConcurrentHashMap<>();
        public Map<String, StateModels.RedemptionCodeState> redemptionCodes = new ConcurrentHashMap<>();
        public Map<String, List<StateModels.FeedbackState>> feedbackByUser = new ConcurrentHashMap<>();
        public Map<String, StateModels.ChatSessionState> chatSessions = new ConcurrentHashMap<>();
        public Map<String, List<StateModels.ChatMessageState>> chatMessagesBySession = new ConcurrentHashMap<>();
    }
}
