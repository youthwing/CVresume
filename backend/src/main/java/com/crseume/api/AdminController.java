package com.crseume.api;

import com.crseume.domain.ApiModels;
import com.crseume.security.AuthUser;
import com.crseume.service.AdminService;
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
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/dashboard")
    public ApiModels.AdminDashboardView dashboard(@AuthenticationPrincipal AuthUser authUser) {
        return adminService.dashboard(authUser);
    }

    @GetMapping("/users")
    public ApiModels.PageResponse<ApiModels.AdminUserView> users(@AuthenticationPrincipal AuthUser authUser,
                                                                 @RequestParam(defaultValue = "0") int page,
                                                                 @RequestParam(defaultValue = "20") int size,
                                                                 @RequestParam(required = false) String q) {
        return adminService.users(authUser, page, size, q);
    }

    @PostMapping("/users/{userId}/credits")
    public ApiModels.UserProfile adjustCredits(@AuthenticationPrincipal AuthUser authUser,
                                               @PathVariable String userId,
                                               @RequestBody ApiModels.AdminAdjustCreditsRequest request) {
        return adminService.adjustUserCredits(authUser, userId, request);
    }

    @GetMapping("/products")
    public List<ApiModels.RedemptionProductView> products(@AuthenticationPrincipal AuthUser authUser) {
        return adminService.products(authUser);
    }

    @PostMapping("/products")
    public ApiModels.RedemptionProductView createProduct(@AuthenticationPrincipal AuthUser authUser,
                                                         @RequestBody ApiModels.AdminProductUpsertRequest request) {
        return adminService.createProduct(authUser, request);
    }

    @PutMapping("/products/{productId}")
    public ApiModels.RedemptionProductView updateProduct(@AuthenticationPrincipal AuthUser authUser,
                                                         @PathVariable String productId,
                                                         @RequestBody ApiModels.AdminProductUpsertRequest request) {
        return adminService.updateProduct(authUser, productId, request);
    }

    @PostMapping("/products/{productId}/codes")
    public ApiModels.AdminGenerateCodesResponse generateCodes(@AuthenticationPrincipal AuthUser authUser,
                                                              @PathVariable String productId,
                                                              @RequestBody ApiModels.AdminGenerateCodesRequest request) {
        return adminService.generateCodes(authUser, productId, request);
    }

    @PostMapping("/redemption-codes/custom")
    public ApiModels.AdminGenerateCodesResponse generateCustomCodes(@AuthenticationPrincipal AuthUser authUser,
                                                                    @RequestBody ApiModels.AdminGenerateCustomCodesRequest request) {
        return adminService.generateCustomCodes(authUser, request);
    }

    @GetMapping("/orders")
    public ApiModels.PageResponse<ApiModels.AdminOrderView> orders(@AuthenticationPrincipal AuthUser authUser,
                                                                   @RequestParam(defaultValue = "0") int page,
                                                                   @RequestParam(defaultValue = "20") int size) {
        return adminService.orders(authUser, page, size);
    }

    @GetMapping("/redemption-codes")
    public ApiModels.PageResponse<ApiModels.AdminRedemptionCodeView> codes(@AuthenticationPrincipal AuthUser authUser,
                                                                            @RequestParam(defaultValue = "0") int page,
                                                                            @RequestParam(defaultValue = "20") int size) {
        return adminService.codes(authUser, page, size);
    }
}
