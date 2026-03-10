package com.crseume.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public final class StateModels {

    private StateModels() {
    }

    public static final class UserAccount {
        public String id;
        public String email;
        public String passwordHash;
        public String displayName;
        public String headline;
        public String locale;
        public String role;
        public boolean proMember;
        public String inviteCode;
        public String referredByInviteCode;
        public int credits;
        public Instant createdAt;
        public Instant lastLoginAt;
    }

    public static final class SessionToken {
        public String token;
        public String userId;
        public Instant expiresAt;
    }

    public static final class VerificationCodeState {
        public String email;
        public String type;
        public String code;
        public Instant sentAt;
        public Instant expiresAt;
    }

    public static final class OAuthProviderState {
        public String providerType;
        public String displayName;
        public String iconUrl;
    }

    public static final class CreditPackageState {
        public String id;
        public String name;
        public String description;
        public int credits;
        public int priceCent;
        public String badge;
        public boolean recommended;
    }

    public static final class CreditLedgerState {
        public String id;
        public String type;
        public int delta;
        public String title;
        public String description;
        public Instant createdAt;
    }

    public static final class ProjectState {
        public String id;
        public String userId;
        public String companyName;
        public String locale;
        public String jdText;
        public String resumeText;
        public List<String> selectedModules = new ArrayList<>();
        public String templateId;
        public boolean usedReferenceImage;
        public String referenceImageName;
        public Instant createdAt;
        public String latestJobId;
    }

    public static final class JobState {
        public String id;
        public String projectId;
        public String userId;
        public String status;
        public int progress;
        public ApiModels.ResumeResult result;
        public String errorMessage;
        public Instant createdAt;
        public Instant updatedAt;
    }

    public static final class SharedResumeState {
        public String id;
        public String jobId;
        public String userId;
        public Instant createdAt;
        public long viewCount;
        public long useCount;
    }

    public static final class OrderState {
        public String id;
        public String userId;
        public String productId;
        public String productType;
        public String title;
        public int amountCent;
        public int credits;
        public boolean grantsPro;
        public String status;
        public String paymentMethod;
        public String payerName;
        public String payerAccount;
        public String paymentReference;
        public String paymentNote;
        public String reviewNote;
        public String reviewedByUserId;
        public Instant reviewedAt;
        public Instant fulfilledAt;
        public String redemptionCodeId;
        public Instant createdAt;
    }

    public static final class RedemptionProductState {
        public String id;
        public String productType;
        public String name;
        public String description;
        public int credits;
        public int priceCent;
        public boolean grantsPro;
        public boolean recommended;
        public boolean active;
    }

    public static final class RedemptionCodeState {
        public String id;
        public String code;
        public String productId;
        public String productType;
        public String productName;
        public int credits;
        public boolean grantsPro;
        public String status;
        public Instant createdAt;
        public String purchasedByUserId;
        public String redeemedByUserId;
        public Instant redeemedAt;
        public String orderId;
    }

    public static final class FeedbackState {
        public String id;
        public String userId;
        public String category;
        public String content;
        public Instant createdAt;
    }

    public static final class ChatSessionState {
        public String id;
        public String userId;
        public String title;
        public String status;
        public Instant createdAt;
        public Instant updatedAt;
    }

    public static final class ChatMessageState {
        public String id;
        public String sessionId;
        public String role;
        public String content;
        public Instant createdAt;
    }
}
