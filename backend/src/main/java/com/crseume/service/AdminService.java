package com.crseume.service;

import com.crseume.domain.ApiModels;
import com.crseume.domain.StateModels;
import com.crseume.security.AuthUser;
import com.crseume.util.IdGenerator;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
public class AdminService {
    private static final int CREDITS_PER_GENERATION = 10;
    private static final int MAX_GENERATE_CODE_COUNT = 500;
    private static final int MAX_GENERATION_COUNT = 1000;

    private final InMemoryStore store;
    private final AuthService authService;

    public AdminService(InMemoryStore store, AuthService authService) {
        this.store = store;
        this.authService = authService;
    }

    public synchronized ApiModels.AdminDashboardView dashboard(AuthUser authUser) {
        authService.requireAdmin(authUser);
        long totalCreditsIssued = store.creditHistoryByUser.values().stream()
            .flatMap(List::stream)
            .filter(entry -> entry.delta > 0)
            .mapToLong(entry -> entry.delta)
            .sum();
        long totalCreditsConsumed = store.creditHistoryByUser.values().stream()
            .flatMap(List::stream)
            .filter(entry -> entry.delta < 0)
            .mapToLong(entry -> Math.abs(entry.delta))
            .sum();
        long proUsers = store.usersById.values().stream().filter(user -> user.proMember).count();
        long adminUsers = store.usersById.values().stream().filter(user -> AuthService.ROLE_ADMIN.equalsIgnoreCase(user.role)).count();
        long redeemedCodes = store.redemptionCodes.values().stream().filter(code -> "REDEEMED".equals(code.status)).count();
        return new ApiModels.AdminDashboardView(
            store.usersById.size(),
            proUsers,
            adminUsers,
            store.orders.size(),
            store.redemptionCodes.size(),
            redeemedCodes,
            store.jobs.size(),
            totalCreditsIssued,
            totalCreditsConsumed
        );
    }

    public synchronized ApiModels.PageResponse<ApiModels.AdminUserView> users(AuthUser authUser, int page, int size, String keyword) {
        authService.requireAdmin(authUser);
        String normalizedKeyword = normalizeKeyword(keyword);
        List<ApiModels.AdminUserView> users = store.usersById.values().stream()
            .filter(user -> matchesUser(user, normalizedKeyword))
            .sorted(Comparator.comparing((StateModels.UserAccount user) -> user.createdAt).reversed())
            .map(this::toAdminUserView)
            .toList();
        return page(users, page, size);
    }

    public synchronized ApiModels.UserProfile adjustUserCredits(AuthUser authUser,
                                                                String userId,
                                                                ApiModels.AdminAdjustCreditsRequest request) {
        authService.requireAdmin(authUser);
        if (request.delta() == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "积分调整值不能为 0");
        }
        authService.adjustCredits(
            userId,
            request.delta(),
            "ADMIN",
            "管理员调整",
            StringUtils.hasText(request.reason()) ? request.reason().trim() : "管理员后台调整积分"
        );
        StateModels.UserAccount user = authService.requireUser(userId);
        return authService.me(new AuthUser(authUser.token(), userId, user.email, user.role, user.proMember));
    }

    public synchronized List<ApiModels.RedemptionProductView> products(AuthUser authUser) {
        authService.requireAdmin(authUser);
        return store.redemptionProducts.stream()
            .sorted(Comparator.comparing((StateModels.RedemptionProductState product) -> !product.recommended))
            .map(this::toProductView)
            .toList();
    }

    public synchronized ApiModels.RedemptionProductView createProduct(AuthUser authUser, ApiModels.AdminProductUpsertRequest request) {
        authService.requireAdmin(authUser);
        StateModels.RedemptionProductState product = new StateModels.RedemptionProductState();
        product.id = IdGenerator.next("prd_");
        applyProductRequest(product, request);
        store.redemptionProducts.add(product);
        syncLegacyCreditPackages();
        store.persist();
        return toProductView(product);
    }

    public synchronized ApiModels.RedemptionProductView updateProduct(AuthUser authUser,
                                                                      String productId,
                                                                      ApiModels.AdminProductUpsertRequest request) {
        authService.requireAdmin(authUser);
        StateModels.RedemptionProductState product = requireProduct(productId);
        applyProductRequest(product, request);
        syncLegacyCreditPackages();
        store.persist();
        return toProductView(product);
    }

    public synchronized ApiModels.AdminGenerateCodesResponse generateCodes(AuthUser authUser,
                                                                           String productId,
                                                                           ApiModels.AdminGenerateCodesRequest request) {
        authService.requireAdmin(authUser);
        StateModels.RedemptionProductState product = requireProduct(productId);
        if (!product.active) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请先上架商品后再生成兑换码");
        }

        int count = validateGenerateCodeCount(request.count());

        List<ApiModels.AdminRedemptionCodeView> generatedCodes = new ArrayList<>();
        for (int index = 0; index < count; index += 1) {
            StateModels.RedemptionCodeState code = createAvailableRedemptionCode(
                product.id,
                product.productType,
                product.name,
                product.credits,
                product.grantsPro
            );
            generatedCodes.add(toAdminCodeView(code));
        }
        store.persist();
        return new ApiModels.AdminGenerateCodesResponse(
            product.id,
            product.name,
            generatedCodes.size(),
            toGenerationCount(product.credits),
            product.credits,
            generatedCodes
        );
    }

    public synchronized ApiModels.AdminGenerateCodesResponse generateCustomCodes(AuthUser authUser,
                                                                                 ApiModels.AdminGenerateCustomCodesRequest request) {
        authService.requireAdmin(authUser);

        int generationCount = validateGenerationCount(request.generationCount());
        int count = validateGenerateCodeCount(request.count());
        int credits = generationCount * CREDITS_PER_GENERATION;
        String productName = "管理员发放 " + generationCount + " 次简历生成";
        String productId = "admin_custom_" + credits;

        List<ApiModels.AdminRedemptionCodeView> generatedCodes = new ArrayList<>();
        for (int index = 0; index < count; index += 1) {
            StateModels.RedemptionCodeState code = createAvailableRedemptionCode(
                productId,
                "POINTS",
                productName,
                credits,
                false
            );
            generatedCodes.add(toAdminCodeView(code));
        }
        store.persist();
        return new ApiModels.AdminGenerateCodesResponse(productId, productName, generatedCodes.size(), generationCount, credits, generatedCodes);
    }

    public synchronized ApiModels.PageResponse<ApiModels.AdminOrderView> orders(AuthUser authUser, int page, int size) {
        authService.requireAdmin(authUser);
        List<ApiModels.AdminOrderView> orders = store.orders.values().stream()
            .sorted(Comparator.comparing((StateModels.OrderState order) -> order.createdAt).reversed())
            .map(this::toAdminOrderView)
            .toList();
        return page(orders, page, size);
    }

    public synchronized ApiModels.PageResponse<ApiModels.AdminRedemptionCodeView> codes(AuthUser authUser, int page, int size) {
        authService.requireAdmin(authUser);
        List<ApiModels.AdminRedemptionCodeView> codes = store.redemptionCodes.values().stream()
            .sorted(Comparator.comparing((StateModels.RedemptionCodeState code) -> code.createdAt).reversed())
            .map(this::toAdminCodeView)
            .toList();
        return page(codes, page, size);
    }

    private void applyProductRequest(StateModels.RedemptionProductState product, ApiModels.AdminProductUpsertRequest request) {
        String productType = normalizeProductType(request.productType());
        int credits = request.credits();
        int priceCent = request.priceCent();
        if (credits <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "积分数量必须大于 0");
        }
        if (priceCent <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "商品价格必须大于 0");
        }
        if (priceCent != credits * 10) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "价格与积分比例不正确，当前系统固定为 1 RMB = 10 积分");
        }

        product.productType = productType;
        product.name = requiredText(request.name(), "请输入商品名称");
        product.description = requiredText(request.description(), "请输入商品描述");
        product.credits = credits;
        product.priceCent = priceCent;
        product.grantsPro = "PRO_PLAN".equals(productType) || request.grantsPro();
        product.recommended = request.recommended();
        product.active = request.active();
    }

    private void syncLegacyCreditPackages() {
        store.creditPackages.clear();
        store.redemptionProducts.stream()
            .filter(item -> item.active && "POINTS".equals(item.productType))
            .forEach(item -> {
                StateModels.CreditPackageState pkg = new StateModels.CreditPackageState();
                pkg.id = item.id;
                pkg.name = item.name;
                pkg.description = item.description;
                pkg.credits = item.credits;
                pkg.priceCent = item.priceCent;
                pkg.badge = item.recommended ? "推荐" : "积分码";
                pkg.recommended = item.recommended;
                store.creditPackages.add(pkg);
            });
    }

    private StateModels.RedemptionProductState requireProduct(String productId) {
        return store.redemptionProducts.stream()
            .filter(item -> item.id.equals(productId))
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "商品不存在"));
    }

    private int validateGenerateCodeCount(int count) {
        if (count <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "生成数量必须大于 0");
        }
        if (count > MAX_GENERATE_CODE_COUNT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "单次最多生成 500 个兑换码");
        }
        return count;
    }

    private int validateGenerationCount(int generationCount) {
        if (generationCount <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "兑换次数必须大于 0");
        }
        if (generationCount > MAX_GENERATION_COUNT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "单个兑换码最多支持 1000 次生成");
        }
        return generationCount;
    }

    private int toGenerationCount(int credits) {
        return Math.max(1, credits / CREDITS_PER_GENERATION);
    }

    private StateModels.RedemptionCodeState createAvailableRedemptionCode(String productId,
                                                                          String productType,
                                                                          String productName,
                                                                          int credits,
                                                                          boolean grantsPro) {
        StateModels.RedemptionCodeState code = new StateModels.RedemptionCodeState();
        code.id = IdGenerator.next("rcode_");
        code.code = ("CRS-" + code.id.substring(Math.max(0, code.id.length() - 6))).toUpperCase(Locale.ROOT);
        code.productId = productId;
        code.productType = productType;
        code.productName = productName;
        code.credits = credits;
        code.grantsPro = grantsPro;
        code.status = "AVAILABLE";
        code.createdAt = Instant.now();
        code.orderId = null;
        store.redemptionCodes.put(code.id, code);
        return code;
    }

    private boolean matchesUser(StateModels.UserAccount user, String keyword) {
        if (keyword == null) {
            return true;
        }
        return user.email.toLowerCase(Locale.ROOT).contains(keyword)
            || user.displayName.toLowerCase(Locale.ROOT).contains(keyword)
            || user.id.toLowerCase(Locale.ROOT).contains(keyword);
    }

    private String normalizeKeyword(String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return null;
        }
        return keyword.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeProductType(String productType) {
        String value = requiredText(productType, "请输入商品类型").toUpperCase(Locale.ROOT);
        return switch (value) {
            case "POINTS", "PRO_PLAN" -> value;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "商品类型仅支持 POINTS 或 PRO_PLAN");
        };
    }

    private String requiredText(String value, String message) {
        if (!StringUtils.hasText(value)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private ApiModels.AdminUserView toAdminUserView(StateModels.UserAccount user) {
        return new ApiModels.AdminUserView(
            user.id,
            user.email,
            user.displayName,
            user.role,
            user.proMember,
            user.credits,
            user.inviteCode,
            user.referredByInviteCode,
            user.createdAt,
            user.lastLoginAt
        );
    }

    private ApiModels.RedemptionProductView toProductView(StateModels.RedemptionProductState product) {
        return new ApiModels.RedemptionProductView(
            product.id,
            product.productType,
            product.name,
            product.description,
            product.credits,
            product.priceCent,
            product.grantsPro,
            product.recommended,
            product.active
        );
    }

    private ApiModels.AdminOrderView toAdminOrderView(StateModels.OrderState order) {
        StateModels.UserAccount user = store.usersById.get(order.userId);
        return new ApiModels.AdminOrderView(
            order.id,
            order.userId,
            user != null ? user.email : "",
            order.productId,
            order.productType,
            order.title,
            order.amountCent,
            order.credits,
            order.grantsPro,
            order.status,
            order.redemptionCodeId,
            order.createdAt
        );
    }

    private ApiModels.AdminRedemptionCodeView toAdminCodeView(StateModels.RedemptionCodeState code) {
        StateModels.UserAccount purchaser = StringUtils.hasText(code.purchasedByUserId) ? store.usersById.get(code.purchasedByUserId) : null;
        StateModels.UserAccount redeemer = StringUtils.hasText(code.redeemedByUserId) ? store.usersById.get(code.redeemedByUserId) : null;
        return new ApiModels.AdminRedemptionCodeView(
            code.id,
            code.code,
            code.productId,
            code.productType,
            code.productName,
            code.credits,
            code.grantsPro,
            code.status,
            code.purchasedByUserId,
            purchaser != null ? purchaser.email : "",
            code.redeemedByUserId,
            redeemer != null ? redeemer.email : "",
            code.createdAt,
            code.redeemedAt,
            code.orderId
        );
    }

    private <T> ApiModels.PageResponse<T> page(List<T> content, int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.max(size, 1);
        int fromIndex = Math.min(safePage * safeSize, content.size());
        int toIndex = Math.min(fromIndex + safeSize, content.size());
        List<T> pageContent = content.subList(fromIndex, toIndex);
        int totalPages = content.isEmpty() ? 0 : (int) Math.ceil((double) content.size() / safeSize);
        ApiModels.SortView sort = new ApiModels.SortView(true, false, true);
        return new ApiModels.PageResponse<>(
            pageContent,
            new ApiModels.PageableView(safePage, safeSize, sort, (long) safePage * safeSize, true, false),
            content.size(),
            totalPages,
            safePage >= Math.max(totalPages - 1, 0),
            safeSize,
            safePage,
            sort,
            pageContent.size(),
            safePage == 0,
            pageContent.isEmpty()
        );
    }
}
