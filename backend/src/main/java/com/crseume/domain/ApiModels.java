package com.crseume.domain;

import java.time.Instant;
import java.util.List;

public final class ApiModels {

    private ApiModels() {
    }

    public record SortView(boolean empty, boolean sorted, boolean unsorted) {
    }

    public record PageableView(int pageNumber, int pageSize, SortView sort, long offset, boolean paged, boolean unpaged) {
    }

    public record PageResponse<T>(List<T> content,
                                  PageableView pageable,
                                  long totalElements,
                                  int totalPages,
                                  boolean last,
                                  int size,
                                  int number,
                                  SortView sort,
                                  int numberOfElements,
                                  boolean first,
                                  boolean empty) {
    }

    public record UserProfile(String id,
                              String email,
                              String displayName,
                              String headline,
                              String locale,
                              String role,
                              boolean proMember,
                              int credits,
                              String inviteCode,
                              Instant createdAt,
                              Instant lastLoginAt) {
    }

    public record AuthPayload(String token, UserProfile user) {
    }

    public record BasicMessage(String message) {
    }

    public record SendCodeResponse(String message,
                                   boolean success,
                                   String demoCode,
                                   Instant expiresAt,
                                   Boolean isRegistered) {
    }

    public record OAuthProvider(String providerType, String displayName, String iconUrl) {
    }

    public record OAuthAuthorizeResponse(String authUrl, String state) {
    }

    public record CreditPackageItem(String id,
                                    String productType,
                                    String name,
                                    String description,
                                    int credits,
                                    int priceCent,
                                    String badge,
                                    boolean recommended,
                                    boolean grantsPro) {
    }

    public record CreditLedgerEntry(String id,
                                    String type,
                                    int delta,
                                    String title,
                                    String description,
                                    Instant createdAt) {
    }

    public record CreditSummary(int balance, int totalConsumed, List<CreditLedgerEntry> history) {
    }

    public record InvitationUserView(String id, String displayName, String email, Instant createdAt) {
    }

    public record InvitationSummaryView(String inviteCode,
                                        int invitedUsers,
                                        int totalEarnedCredits,
                                        int rewardPerInvite,
                                        int rewardForInvitee,
                                        List<InvitationUserView> invitees) {
    }

    public record OrderView(String id,
                            String productId,
                            String productType,
                            String title,
                            int amountCent,
                            int credits,
                            boolean grantsPro,
                            String status,
                            String paymentMethod,
                            String payerName,
                            String payerAccount,
                            String paymentReference,
                            String paymentNote,
                            String reviewNote,
                            Instant reviewedAt,
                            Instant fulfilledAt,
                            String redemptionCodeId,
                            Instant createdAt) {
    }

    public record RedemptionProductView(String id,
                                        String productType,
                                        String name,
                                        String description,
                                        int credits,
                                        int priceCent,
                                        boolean grantsPro,
                                        boolean recommended,
                                        boolean active) {
    }

    public record RedemptionCodeView(String id,
                                     String code,
                                     String productId,
                                     String productType,
                                     String productName,
                                     int credits,
                                     boolean grantsPro,
                                     String status,
                                     Instant createdAt,
                                     Instant redeemedAt,
                                     String orderId) {
    }

    public record PurchaseResponse(OrderView order, int balance, RedemptionCodeView code, String message) {
    }

    public record CandidateProfile(String displayName,
                                   String title,
                                   String location,
                                   String email,
                                   String phone,
                                   String yearsOfExperience,
                                   String targetRole,
                                   String employmentStatus) {
    }

    public record ResumeSkills(List<String> primary, List<String> secondary) {
    }

    public record ResumeExperience(String title,
                                   String company,
                                   String period,
                                   String highlights,
                                   List<String> bullets) {
    }

    public record ResumeProject(String name,
                                String role,
                                String period,
                                String organization,
                                List<String> bullets) {
    }

    public record EducationItem(String school, String major, String period, String degree) {
    }

    public record ResumeResult(String jobId,
                               String companyName,
                               int matchScore,
                               String locale,
                               String templateId,
                               List<String> selectedModules,
                               ResumeSkills skills,
                               String summary,
                               List<String> atsKeywords,
                               List<String> jobKeywords,
                               List<String> suggestions,
                               List<ResumeExperience> experiences,
                               List<ResumeProject> projects,
                               List<EducationItem> education,
                               String personalEvaluation,
                               CandidateProfile candidateProfile,
                               int version,
                               boolean usedReferenceImage) {
    }

    public record ProjectView(String id,
                              String companyName,
                              String locale,
                              String jdText,
                              String resumeText,
                              List<String> selectedModules,
                              String templateId,
                              boolean usedReferenceImage,
                              Instant createdAt,
                              String latestJobId) {
    }

    public record JobView(String id,
                          String projectId,
                          String status,
                          int progress,
                          ResumeResult result,
                          String errorMessage,
                          Instant createdAt,
                          Instant updatedAt) {
    }

    public record SharedResumeView(String id,
                                   String companyName,
                                   int matchScore,
                                   String templateId,
                                   String locale,
                                   ResumeResult resumePreview,
                                   long viewCount,
                                   long useCount,
                                   Instant createdAt,
                                   boolean mine) {
    }

    public record CountResponse(long viewCount, long useCount) {
    }

    public record FeedbackView(String id, String category, String content, Instant createdAt) {
    }

    public record ChatSessionView(String id, String title, String status, Instant createdAt, Instant updatedAt) {
    }

    public record ChatMessageView(String id, String role, String content, Instant createdAt) {
    }

    public record ChatHistoryView(List<ChatSessionView> content, String nextCursor) {
    }

    public record SendCodeRequest(String email, String type, String locale) {
    }

    public record LoginRequest(String email, String password, String code, String locale) {
    }

    public record RegisterRequest(String email,
                                  String password,
                                  String displayName,
                                  String code,
                                  String inviteCode,
                                  String locale) {
    }

    public record UpdateProfileRequest(String displayName, String headline, String locale) {
    }

    public record OAuthCallbackRequest(String code, String state, String locale) {
    }

    public record CreateProjectRequest(String companyName,
                                       String locale,
                                       String jdText,
                                       String resumeText,
                                       List<String> selectedModules,
                                       String templateId) {
    }

    public record GenerateRequest(String companyName,
                                  String locale,
                                  String jdText,
                                  String resumeText,
                                  List<String> selectedModules,
                                  String templateId) {
    }

    public record UpdateTemplateRequest(String templateId) {
    }

    public record UpdateResumeContentRequest(int version, ResumeResult resumeData, CandidateProfile candidateProfile) {
    }

    public record PolishResumeRequest(String instruction, ResumeResult resumeData, CandidateProfile candidateProfile) {
    }

    public record CreateSharedResumeRequest(String jobId) {
    }

    public record CreateOrderRequest(String productId,
                                     Integer customCredits,
                                     String paymentMethod,
                                     String payerName,
                                     String payerAccount,
                                     String paymentReference,
                                     String note) {
    }

    public record RedeemRequest(String code) {
    }

    public record FeedbackRequest(String category, String content) {
    }

    public record AdminDashboardView(long totalUsers,
                                     long proUsers,
                                     long adminUsers,
                                     long totalOrders,
                                     long totalCodes,
                                     long redeemedCodes,
                                     long totalJobs,
                                     long totalCreditsIssued,
                                     long totalCreditsConsumed) {
    }

    public record AdminUserView(String id,
                                String email,
                                String displayName,
                                String role,
                                boolean proMember,
                                int credits,
                                String inviteCode,
                                String referredByInviteCode,
                                Instant createdAt,
                                Instant lastLoginAt) {
    }

    public record AdminAdjustCreditsRequest(int delta, String reason) {
    }

    public record AdminOrderView(String id,
                                 String userId,
                                 String userEmail,
                                 String userDisplayName,
                                 String productId,
                                 String productType,
                                 String title,
                                 int amountCent,
                                 int credits,
                                 boolean grantsPro,
                                 String status,
                                 String paymentMethod,
                                 String payerName,
                                 String payerAccount,
                                 String paymentReference,
                                 String paymentNote,
                                 String reviewNote,
                                 String reviewedByUserId,
                                 String reviewedByEmail,
                                 Instant reviewedAt,
                                 Instant fulfilledAt,
                                 String redemptionCodeId,
                                 Instant createdAt) {
    }

    public record AdminReviewOrderRequest(String note) {
    }

    public record AdminRedemptionCodeView(String id,
                                          String code,
                                          String productId,
                                          String productType,
                                          String productName,
                                          int credits,
                                          boolean grantsPro,
                                          String status,
                                          String purchasedByUserId,
                                          String purchasedByEmail,
                                          String redeemedByUserId,
                                          String redeemedByEmail,
                                          Instant createdAt,
                                          Instant redeemedAt,
                                          String orderId) {
    }

    public record AdminProductUpsertRequest(String productType,
                                            String name,
                                            String description,
                                            int credits,
                                            int priceCent,
                                            boolean grantsPro,
                                            boolean recommended,
                                            boolean active) {
    }

    public record AdminGenerateCodesRequest(int count) {
    }

    public record AdminGenerateCustomCodesRequest(int generationCount, int count) {
    }

    public record AdminGenerateCodesResponse(String productId,
                                             String productName,
                                             int count,
                                             int generationCount,
                                             int creditsPerCode,
                                             List<AdminRedemptionCodeView> codes) {
    }
}
