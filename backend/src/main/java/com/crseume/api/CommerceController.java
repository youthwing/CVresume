package com.crseume.api;

import com.crseume.domain.ApiModels;
import com.crseume.security.AuthUser;
import com.crseume.service.PlatformService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class CommerceController {

    private final PlatformService platformService;

    public CommerceController(PlatformService platformService) {
        this.platformService = platformService;
    }

    @GetMapping("/credits")
    public ApiModels.CreditSummary credits(@AuthenticationPrincipal AuthUser authUser) {
        return platformService.getCredits(authUser);
    }

    @GetMapping("/credits/packages")
    public List<ApiModels.CreditPackageItem> creditPackages() {
        return platformService.getCreditPackages();
    }

    @PostMapping("/credits/packages/{packageId}/purchase")
    public ApiModels.PurchaseResponse purchasePackage(@AuthenticationPrincipal AuthUser authUser,
                                                      @PathVariable String packageId) {
        return platformService.purchaseCreditPackage(authUser, packageId);
    }

    @PostMapping("/orders")
    public ApiModels.OrderView createOrder(@AuthenticationPrincipal AuthUser authUser,
                                           @RequestBody ApiModels.CreateOrderRequest request) {
        return platformService.createOrder(authUser, request);
    }

    @GetMapping("/orders")
    public ApiModels.PageResponse<ApiModels.OrderView> orders(@AuthenticationPrincipal AuthUser authUser,
                                                              @RequestParam(defaultValue = "0") int page,
                                                              @RequestParam(defaultValue = "10") int size) {
        return platformService.listOrders(authUser, page, size);
    }

    @GetMapping("/orders/{orderId}")
    public ApiModels.OrderView order(@AuthenticationPrincipal AuthUser authUser, @PathVariable String orderId) {
        return platformService.getOrder(authUser, orderId);
    }

    @PostMapping("/orders/{orderId}/cancel")
    public ApiModels.OrderView cancelOrder(@AuthenticationPrincipal AuthUser authUser, @PathVariable String orderId) {
        return platformService.cancelOrder(authUser, orderId);
    }

    @GetMapping("/redemption/products")
    public List<ApiModels.RedemptionProductView> redemptionProducts() {
        return platformService.getRedemptionProducts();
    }

    @GetMapping("/redemption/codes")
    public List<ApiModels.RedemptionCodeView> redemptionCodes(@AuthenticationPrincipal AuthUser authUser,
                                                              @RequestParam(defaultValue = "50") int size) {
        return platformService.getRedemptionCodes(authUser, size);
    }

    @GetMapping("/redemption/purchased")
    public List<ApiModels.RedemptionCodeView> purchasedCodes(@AuthenticationPrincipal AuthUser authUser) {
        return platformService.purchasedCodes(authUser);
    }

    @GetMapping("/redemption/history")
    public List<ApiModels.RedemptionCodeView> redemptionHistory(@AuthenticationPrincipal AuthUser authUser) {
        return platformService.redemptionHistory(authUser);
    }

    @PostMapping("/redemption/products/{productId}/purchase")
    public ApiModels.PurchaseResponse purchaseRedemptionProduct(@AuthenticationPrincipal AuthUser authUser,
                                                                @PathVariable String productId) {
        return platformService.purchaseRedemptionProduct(authUser, productId);
    }

    @PostMapping("/redemption/codes/{codeId}/purchase")
    public ApiModels.PurchaseResponse purchaseRedemptionCode(@AuthenticationPrincipal AuthUser authUser,
                                                             @PathVariable String codeId) {
        return platformService.purchaseRedemptionCode(authUser, codeId);
    }

    @PostMapping("/redemption/redeem")
    public ApiModels.PurchaseResponse redeem(@AuthenticationPrincipal AuthUser authUser,
                                             @RequestBody ApiModels.RedeemRequest request) {
        return platformService.redeem(authUser, request);
    }
}
