package com.crseume.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.crseume.domain.ApiModels;
import com.crseume.domain.StateModels;
import com.crseume.security.AuthUser;
import com.crseume.util.IdGenerator;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.MatchResult;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class PlatformService {

    private static final Logger log = LoggerFactory.getLogger(PlatformService.class);
    private static final int GENERATION_COST = 10;

    private static final List<String> DEFAULT_MODULES = List.of("教育经历", "专业技能", "工作经历", "项目经历", "个人评价");
    private static final List<String> KNOWN_KEYWORDS = List.of(
        "React", "Vue3", "TypeScript", "JavaScript", "Next.js", "Spring Boot", "Java",
        "Node.js", "Taro", "UniApp", "Webpack", "Vite", "微前端", "性能优化", "工程化",
        "数据可视化", "Redis", "MySQL", "PostgreSQL", "Docker", "Kubernetes", "ATS",
        "低代码", "中后台", "业务抽象", "增长", "BFF", "GraphQL", "小程序", "鸿蒙"
    );
    private static final Pattern TOKEN_PATTERN = Pattern.compile("[A-Za-z0-9.+#-]{2,}|[\\u4e00-\\u9fa5]{2,8}");

    private final InMemoryStore store;
    private final AuthService authService;
    private final ObjectMapper objectMapper;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build();
    @Value("${app.llm.enabled:true}")
    private boolean llmEnabled;
    @Value("${app.llm.api-key:}")
    private String llmApiKey;
    @Value("${app.llm.base-url:https://dashscope.aliyuncs.com/compatible-mode/v1}")
    private String llmBaseUrl;
    @Value("${app.llm.model:qwen-plus}")
    private String llmModel;

    public PlatformService(InMemoryStore store, AuthService authService, ObjectMapper objectMapper) {
        this.store = store;
        this.authService = authService;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void seedDemoData() {
        if (!store.sharedResumes.isEmpty()) {
            return;
        }

        StateModels.UserAccount seedUser = authService.ensureSeedUser(
            "showcase@crseume.local",
            "showcase123456",
            "示例候选人",
            "用于演示简历广场",
            "zh",
            1200
        );

        seedSharedResume(seedUser, "阿里巴巴", "前端工程师", "精通 Vue3 / React18 / 工程化 / 小程序 / 性能优化");
        seedSharedResume(seedUser, "字节跳动", "高级前端工程师", "偏中后台、增长体系、数据分析与工程效率建设");
        seedSharedResume(seedUser, "腾讯", "Web 研发工程师", "偏 IM 业务、跨端体验、性能优化与大型项目协作");
        seedSharedResume(seedUser, "小米", "前端架构师", "偏 BFF、设计系统、低代码平台与组件体系建设");
        store.persist();
    }

    public synchronized ApiModels.CreditSummary getCredits(AuthUser authUser) {
        StateModels.UserAccount user = authService.requireUser(authUser.userId());
        return new ApiModels.CreditSummary(
            user.credits,
            authService.totalConsumed(user.id),
            authService.creditHistory(user.id)
        );
    }

    public List<ApiModels.CreditPackageItem> getCreditPackages() {
        return store.creditPackages.stream()
            .map(item -> new ApiModels.CreditPackageItem(
                item.id,
                "POINTS",
                item.name,
                item.description,
                item.credits,
                item.priceCent,
                item.badge,
                item.recommended,
                false
            ))
            .toList();
    }

    public synchronized ApiModels.PurchaseResponse purchaseCreditPackage(AuthUser authUser, String packageId) {
        StateModels.RedemptionProductState product = requireProduct(packageId);
        if (!"POINTS".equals(product.productType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "该商品不属于积分兑换码");
        }
        return purchaseRedemptionProduct(authUser, product.id);
    }

    public synchronized ApiModels.OrderView createOrder(AuthUser authUser, ApiModels.CreateOrderRequest request) {
        StateModels.UserAccount user = authService.requireUser(authUser.userId());
        StateModels.RedemptionProductState product = requireProduct(requiredText(request.productType(), "缺少 productType"));
        StateModels.OrderState order = createPaidOrder(user.id, product);
        store.persist();
        return toOrderView(order);
    }

    public synchronized ApiModels.PageResponse<ApiModels.OrderView> listOrders(AuthUser authUser, int page, int size) {
        List<ApiModels.OrderView> orders = store.orders.values().stream()
            .filter(order -> order.userId.equals(authUser.userId()))
            .sorted(Comparator.comparing((StateModels.OrderState order) -> order.createdAt).reversed())
            .map(this::toOrderView)
            .toList();
        return page(orders, page, size);
    }

    public synchronized ApiModels.OrderView getOrder(AuthUser authUser, String orderId) {
        StateModels.OrderState order = requireOrderOwned(authUser.userId(), orderId);
        return toOrderView(order);
    }

    public synchronized ApiModels.OrderView cancelOrder(AuthUser authUser, String orderId) {
        StateModels.OrderState order = requireOrderOwned(authUser.userId(), orderId);
        if (!Objects.equals(order.status, "PENDING")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前订单不可取消");
        }
        order.status = "CANCELLED";
        store.persist();
        return toOrderView(order);
    }

    public List<ApiModels.RedemptionProductView> getRedemptionProducts() {
        return store.redemptionProducts.stream()
            .filter(item -> item.active)
            .sorted(Comparator.comparing((StateModels.RedemptionProductState item) -> !item.recommended))
            .map(item -> new ApiModels.RedemptionProductView(
                item.id,
                item.productType,
                item.name,
                item.description,
                item.credits,
                item.priceCent,
                item.grantsPro,
                item.recommended,
                item.active
            ))
            .toList();
    }

    public synchronized List<ApiModels.RedemptionCodeView> getRedemptionCodes(AuthUser authUser, int size) {
        authService.requireUser(authUser.userId());
        return store.redemptionCodes.values().stream()
            .filter(code -> authUser.userId().equals(code.purchasedByUserId))
            .sorted(Comparator.comparing((StateModels.RedemptionCodeState code) -> code.createdAt).reversed())
            .limit(Math.max(size, 1))
            .map(this::toRedemptionCodeView)
            .toList();
    }

    public synchronized List<ApiModels.RedemptionCodeView> purchasedCodes(AuthUser authUser) {
        authService.requireUser(authUser.userId());
        return store.redemptionCodes.values().stream()
            .filter(code -> authUser.userId().equals(code.purchasedByUserId))
            .filter(code -> !"REDEEMED".equals(code.status))
            .sorted(Comparator.comparing((StateModels.RedemptionCodeState code) -> code.createdAt).reversed())
            .map(this::toRedemptionCodeView)
            .toList();
    }

    public synchronized ApiModels.PurchaseResponse purchaseRedemptionProduct(AuthUser authUser, String productId) {
        StateModels.UserAccount user = authService.requireUser(authUser.userId());
        StateModels.RedemptionProductState product = requireProduct(productId);
        StateModels.OrderState order = createPaidOrder(user.id, product);
        StateModels.RedemptionCodeState code = createRedemptionCode(product, user.id, order.id);
        order.redemptionCodeId = code.id;
        store.persist();
        return new ApiModels.PurchaseResponse(toOrderView(order), user.credits, toRedemptionCodeView(code), "购买成功，兑换码已生成");
    }

    public synchronized ApiModels.PurchaseResponse purchaseRedemptionCode(AuthUser authUser, String codeId) {
        StateModels.UserAccount user = authService.requireUser(authUser.userId());
        StateModels.RedemptionCodeState code = requireRedemptionCode(codeId);
        if (StringUtils.hasText(code.purchasedByUserId) && !code.purchasedByUserId.equals(user.id)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "该兑换码已被购买");
        }
        code.purchasedByUserId = user.id;
        code.status = "PURCHASED";
        store.persist();
        return new ApiModels.PurchaseResponse(null, user.credits, toRedemptionCodeView(code), "兑换码已归属到当前账户");
    }

    public synchronized ApiModels.PurchaseResponse redeem(AuthUser authUser, ApiModels.RedeemRequest request) {
        StateModels.UserAccount user = authService.requireUser(authUser.userId());
        StateModels.RedemptionCodeState code = store.redemptionCodes.values().stream()
            .filter(item -> item.code.equalsIgnoreCase(requiredText(request.code(), "请输入兑换码")))
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "兑换码不存在"));

        if ("REDEEMED".equals(code.status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "兑换码已使用");
        }

        code.status = "REDEEMED";
        code.redeemedByUserId = user.id;
        code.redeemedAt = Instant.now();
        if (!StringUtils.hasText(code.purchasedByUserId)) {
            code.purchasedByUserId = user.id;
        }
        int balance = authService.adjustCredits(user.id, code.credits, "REDEEM", "兑换码到账", "兑换码 " + code.code + " 使用成功");
        if (code.grantsPro) {
            authService.activateProMembership(user.id, "专业版开通", "兑换专业版礼包，已开通专业版身份");
        }
        return new ApiModels.PurchaseResponse(null, balance, toRedemptionCodeView(code), "兑换成功");
    }

    public synchronized List<ApiModels.RedemptionCodeView> redemptionHistory(AuthUser authUser) {
        return store.redemptionCodes.values().stream()
            .filter(code -> authUser.userId().equals(code.redeemedByUserId))
            .sorted(Comparator.comparing((StateModels.RedemptionCodeState code) -> code.redeemedAt, Comparator.nullsLast(Comparator.reverseOrder())))
            .map(this::toRedemptionCodeView)
            .toList();
    }

    public synchronized ApiModels.ProjectView createProject(AuthUser authUser, ApiModels.CreateProjectRequest request) {
        StateModels.UserAccount user = authService.requireUser(authUser.userId());
        StateModels.ProjectState project = new StateModels.ProjectState();
        project.id = IdGenerator.next("prj_");
        project.userId = user.id;
        project.companyName = defaultCompany(request.companyName());
        project.locale = normalizeLocale(request.locale());
        project.jdText = defaultText(request.jdText(), "负责核心业务前端开发，关注性能优化、工程化和用户体验。");
        project.resumeText = defaultText(request.resumeText(), "5年+ 前端开发经验，熟悉 React / Vue / TypeScript / Node.js。");
        project.selectedModules = normalizeModules(request.selectedModules());
        project.templateId = defaultTemplate(request.templateId());
        project.createdAt = Instant.now();
        store.projects.put(project.id, project);
        store.persist();
        return toProjectView(project);
    }

    public synchronized List<ApiModels.ProjectView> listProjects(AuthUser authUser) {
        authService.requireUser(authUser.userId());
        return store.projects.values().stream()
            .filter(project -> project.userId.equals(authUser.userId()))
            .sorted(Comparator.comparing((StateModels.ProjectState project) -> project.createdAt).reversed())
            .map(this::toProjectView)
            .toList();
    }

    public synchronized ApiModels.ProjectView getProject(AuthUser authUser, String projectId) {
        return toProjectView(requireProjectOwned(authUser.userId(), projectId));
    }

    public synchronized void deleteProject(AuthUser authUser, String projectId) {
        StateModels.ProjectState project = requireProjectOwned(authUser.userId(), projectId);
        store.projects.remove(project.id);
        store.persist();
    }

    public synchronized ApiModels.JobView generate(AuthUser authUser,
                                                   String projectId,
                                                   ApiModels.GenerateRequest request,
                                                   MultipartFile image) {
        StateModels.UserAccount user = authService.requireUser(authUser.userId());
        StateModels.ProjectState project = requireProjectOwned(user.id, projectId);
        mergeProject(project, request, image);

        authService.adjustCredits(user.id, -GENERATION_COST, "GENERATE", "生成定制简历", "生成简历扣减 10 积分");

        StateModels.JobState job = new StateModels.JobState();
        job.id = IdGenerator.next("job_");
        job.projectId = project.id;
        job.userId = user.id;
        job.status = "PENDING";
        job.progress = 5;
        job.createdAt = Instant.now();
        job.updatedAt = job.createdAt;
        store.jobs.put(job.id, job);
        project.latestJobId = job.id;
        store.persist();

        executor.submit(() -> processJob(job.id));
        return toJobView(job);
    }

    public synchronized ApiModels.JobView getJob(AuthUser authUser, String jobId) {
        return toJobView(requireJobOwned(authUser.userId(), jobId));
    }

    public synchronized ApiModels.ResumeResult getJobResult(AuthUser authUser, String jobId) {
        StateModels.JobState job = requireJobOwned(authUser.userId(), jobId);
        if (job.result == null) {
            throw new ResponseStatusException(HttpStatus.ACCEPTED, "任务尚未完成");
        }
        return job.result;
    }

    public synchronized ApiModels.JobView retry(AuthUser authUser, String jobId) {
        StateModels.JobState previousJob = requireJobOwned(authUser.userId(), jobId);
        StateModels.ProjectState project = requireProjectOwned(authUser.userId(), previousJob.projectId);
        ApiModels.GenerateRequest generateRequest = new ApiModels.GenerateRequest(
            project.companyName,
            project.locale,
            project.jdText,
            project.resumeText,
            project.selectedModules,
            project.templateId
        );
        return generate(authUser, project.id, generateRequest, null);
    }

    public synchronized ApiModels.JobView updateTemplate(AuthUser authUser, String jobId, ApiModels.UpdateTemplateRequest request) {
        StateModels.JobState job = requireJobOwned(authUser.userId(), jobId);
        if (job.result == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "任务尚未生成结果");
        }
        job.result = withTemplate(job.result, defaultTemplate(request.templateId()));
        job.updatedAt = Instant.now();
        StateModels.ProjectState project = store.projects.get(job.projectId);
        if (project != null) {
            project.templateId = job.result.templateId();
        }
        store.persist();
        return toJobView(job);
    }

    public synchronized ApiModels.ResumeResult updateResumeContent(AuthUser authUser,
                                                                   String jobId,
                                                                   ApiModels.UpdateResumeContentRequest request) {
        StateModels.JobState job = requireJobOwned(authUser.userId(), jobId);
        if (job.result == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "任务尚未生成结果");
        }
        ApiModels.ResumeResult resumeData = request.resumeData();
        ApiModels.CandidateProfile profile = request.candidateProfile() != null ? request.candidateProfile() : job.result.candidateProfile();
        List<String> selectedModules = normalizeModules(
            resumeData.selectedModules() != null ? resumeData.selectedModules() : job.result.selectedModules()
        );
        job.result = new ApiModels.ResumeResult(
            job.result.jobId(),
            job.result.companyName(),
            resumeData.matchScore(),
            job.result.locale(),
            resumeData.templateId(),
            selectedModules,
            resumeData.skills(),
            resumeData.summary(),
            resumeData.atsKeywords(),
            resumeData.jobKeywords(),
            resumeData.suggestions(),
            resumeData.experiences(),
            resumeData.projects(),
            resumeData.education(),
            resumeData.personalEvaluation(),
            profile,
            Math.max(request.version(), job.result.version()) + 1,
            resumeData.usedReferenceImage()
        );
        job.updatedAt = Instant.now();
        store.persist();
        return job.result;
    }

    public synchronized ApiModels.ResumeResult polishResume(AuthUser authUser,
                                                            String jobId,
                                                            ApiModels.PolishResumeRequest request) {
        StateModels.JobState job = requireJobOwned(authUser.userId(), jobId);
        if (job.result == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "任务尚未生成结果");
        }
        if (!llmEnabled || !StringUtils.hasText(llmApiKey)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前未配置可用的大模型服务");
        }

        StateModels.ProjectState project = requireProjectOwned(authUser.userId(), job.projectId);
        StateModels.UserAccount user = authService.requireUser(authUser.userId());
        ApiModels.ResumeResult currentResume = normalizeResumeForPolish(job, request);
        JsonNode generated = requestQwenJson(
            buildQwenPolishSystemPrompt(project.locale),
            buildQwenPolishUserPrompt(project, user, currentResume, requiredText(request.instruction(), "请先输入润色要求"))
        );
        if (generated == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "大模型润色失败，请稍后重试");
        }

        return mergePolishedResume(job.id, project, currentResume, generated);
    }

    public synchronized ApiModels.SharedResumeView createSharedResume(AuthUser authUser, String jobId) {
        StateModels.JobState job = requireJobOwned(authUser.userId(), jobId);
        if (job.result == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "任务尚未完成");
        }

        StateModels.SharedResumeState existing = store.sharedResumes.values().stream()
            .filter(item -> item.jobId.equals(jobId))
            .findFirst()
            .orElse(null);
        if (existing != null) {
            return toSharedResumeView(existing, authUser.userId());
        }

        StateModels.SharedResumeState sharedResume = new StateModels.SharedResumeState();
        sharedResume.id = IdGenerator.next("share_");
        sharedResume.jobId = job.id;
        sharedResume.userId = authUser.userId();
        sharedResume.createdAt = Instant.now();
        store.sharedResumes.put(sharedResume.id, sharedResume);
        store.persist();
        return toSharedResumeView(sharedResume, authUser.userId());
    }

    public synchronized ApiModels.PageResponse<ApiModels.SharedResumeView> listSharedResumes(int page, int size, String viewerUserId) {
        List<ApiModels.SharedResumeView> resumes = store.sharedResumes.values().stream()
            .sorted(Comparator.comparing((StateModels.SharedResumeState item) -> item.createdAt).reversed())
            .map(item -> toSharedResumeView(item, viewerUserId))
            .toList();
        return page(resumes, page, size);
    }

    public synchronized ApiModels.PageResponse<ApiModels.SharedResumeView> mySharedResumes(AuthUser authUser, int page, int size) {
        List<ApiModels.SharedResumeView> resumes = store.sharedResumes.values().stream()
            .filter(item -> item.userId.equals(authUser.userId()))
            .sorted(Comparator.comparing((StateModels.SharedResumeState item) -> item.createdAt).reversed())
            .map(item -> toSharedResumeView(item, authUser.userId()))
            .toList();
        return page(resumes, page, size);
    }

    public synchronized ApiModels.SharedResumeView getSharedResume(String sharedResumeId, String viewerUserId) {
        return toSharedResumeView(requireSharedResume(sharedResumeId), viewerUserId);
    }

    public synchronized ApiModels.CountResponse recordView(String sharedResumeId) {
        StateModels.SharedResumeState sharedResume = requireSharedResume(sharedResumeId);
        sharedResume.viewCount += 1;
        store.persist();
        return new ApiModels.CountResponse(sharedResume.viewCount, sharedResume.useCount);
    }

    public synchronized ApiModels.CountResponse recordUse(String sharedResumeId) {
        StateModels.SharedResumeState sharedResume = requireSharedResume(sharedResumeId);
        sharedResume.useCount += 1;
        store.persist();
        return new ApiModels.CountResponse(sharedResume.viewCount, sharedResume.useCount);
    }

    public synchronized void deleteSharedResume(AuthUser authUser, String sharedResumeId) {
        StateModels.SharedResumeState sharedResume = requireSharedResume(sharedResumeId);
        if (!sharedResume.userId.equals(authUser.userId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权删除该共享简历");
        }
        store.sharedResumes.remove(sharedResume.id);
        store.persist();
    }

    public synchronized ApiModels.FeedbackView submitFeedback(AuthUser authUser, ApiModels.FeedbackRequest request) {
        authService.requireUser(authUser.userId());
        StateModels.FeedbackState feedback = new StateModels.FeedbackState();
        feedback.id = IdGenerator.next("fb_");
        feedback.userId = authUser.userId();
        feedback.category = StringUtils.hasText(request.category()) ? request.category().trim() : "general";
        feedback.content = requiredText(request.content(), "反馈内容不能为空");
        feedback.createdAt = Instant.now();
        store.feedbackByUser.computeIfAbsent(authUser.userId(), ignored -> new ArrayList<>()).add(feedback);
        store.persist();
        return new ApiModels.FeedbackView(feedback.id, feedback.category, feedback.content, feedback.createdAt);
    }

    public synchronized ApiModels.PageResponse<ApiModels.FeedbackView> feedbackList(AuthUser authUser, int page, int size) {
        List<ApiModels.FeedbackView> feedback = store.feedbackByUser.getOrDefault(authUser.userId(), List.of()).stream()
            .sorted(Comparator.comparing((StateModels.FeedbackState item) -> item.createdAt).reversed())
            .map(item -> new ApiModels.FeedbackView(item.id, item.category, item.content, item.createdAt))
            .toList();
        return page(feedback, page, size);
    }

    public synchronized ApiModels.ChatSessionView currentChat(AuthUser authUser) {
        authService.requireUser(authUser.userId());
        StateModels.ChatSessionState active = store.chatSessions.values().stream()
            .filter(session -> session.userId.equals(authUser.userId()) && "OPEN".equals(session.status))
            .max(Comparator.comparing(session -> session.updatedAt))
            .orElseGet(() -> createChatSession(authUser.userId(), "求职优化对话"));
        return toChatSessionView(active);
    }

    public synchronized List<ApiModels.ChatMessageView> messages(AuthUser authUser, String sessionId) {
        StateModels.ChatSessionState session = requireChatSessionOwned(authUser.userId(), sessionId);
        return store.chatMessagesBySession.getOrDefault(session.id, List.of()).stream()
            .sorted(Comparator.comparing(item -> item.createdAt))
            .map(this::toChatMessageView)
            .toList();
    }

    public synchronized ApiModels.ChatSessionView closeChat(AuthUser authUser, String sessionId) {
        StateModels.ChatSessionState session = requireChatSessionOwned(authUser.userId(), sessionId);
        session.status = "CLOSED";
        session.updatedAt = Instant.now();
        store.persist();
        return toChatSessionView(session);
    }

    public synchronized ApiModels.ChatHistoryView chatHistory(AuthUser authUser, String cursor, int size) {
        int offset = 0;
        if (StringUtils.hasText(cursor)) {
            try {
                offset = Integer.parseInt(cursor);
            } catch (NumberFormatException ignored) {
                offset = 0;
            }
        }

        List<ApiModels.ChatSessionView> sessions = store.chatSessions.values().stream()
            .filter(session -> session.userId.equals(authUser.userId()))
            .sorted(Comparator.comparing((StateModels.ChatSessionState session) -> session.updatedAt).reversed())
            .map(this::toChatSessionView)
            .toList();

        int safeOffset = Math.min(Math.max(offset, 0), sessions.size());
        int end = Math.min(safeOffset + Math.max(size, 1), sessions.size());
        String nextCursor = end < sessions.size() ? String.valueOf(end) : null;
        return new ApiModels.ChatHistoryView(sessions.subList(safeOffset, end), nextCursor);
    }

    private void processJob(String jobId) {
        StateModels.ProjectState project;
        StateModels.UserAccount user;
        synchronized (this) {
            StateModels.JobState job = requireJob(jobId);
            job.status = "RUNNING";
            job.progress = 32;
            job.updatedAt = Instant.now();
            project = store.projects.get(job.projectId);
            user = authService.requireUser(job.userId);
            store.persist();
        }

        sleep(450);
        synchronized (this) {
            StateModels.JobState job = requireJob(jobId);
            job.progress = 68;
            job.updatedAt = Instant.now();
            store.persist();
        }

        sleep(550);
        ApiModels.ResumeResult generatedResult = buildResumeResult(project, user, jobId);
        synchronized (this) {
            StateModels.JobState job = requireJob(jobId);
            job.result = generatedResult;
            job.status = "SUCCEEDED";
            job.progress = 100;
            job.updatedAt = Instant.now();
            appendChatSummary(user.id, job.result);
            store.persist();
        }
    }

    private void appendChatSummary(String userId, ApiModels.ResumeResult result) {
        StateModels.ChatSessionState session = store.chatSessions.values().stream()
            .filter(item -> item.userId.equals(userId) && "OPEN".equals(item.status))
            .max(Comparator.comparing(item -> item.updatedAt))
            .orElseGet(() -> createChatSession(userId, "简历生成分析"));

        StateModels.ChatMessageState message = new StateModels.ChatMessageState();
        message.id = IdGenerator.next("msg_");
        message.sessionId = session.id;
        message.role = "assistant";
        message.content = "已完成 %s 岗位简历生成，当前匹配度 %d 分。建议优先补强：%s。".formatted(
            result.companyName(),
            result.matchScore(),
            String.join("、", result.suggestions().stream().limit(2).toList())
        );
        message.createdAt = Instant.now();
        store.chatMessagesBySession.computeIfAbsent(session.id, ignored -> new ArrayList<>()).add(message);
        session.updatedAt = message.createdAt;
    }

    private StateModels.ChatSessionState createChatSession(String userId, String title) {
        StateModels.ChatSessionState session = new StateModels.ChatSessionState();
        session.id = IdGenerator.next("chat_");
        session.userId = userId;
        session.title = title;
        session.status = "OPEN";
        session.createdAt = Instant.now();
        session.updatedAt = session.createdAt;
        store.chatSessions.put(session.id, session);
        store.persist();
        return session;
    }

    private ApiModels.ResumeResult buildResumeResult(StateModels.ProjectState project, StateModels.UserAccount user, String jobId) {
        ApiModels.ResumeResult fallback = buildSyntheticResumeResult(project, user, jobId);
        ApiModels.ResumeResult generated = buildResumeResultWithQwen(project, user, jobId, fallback);
        return generated != null ? generated : fallback;
    }

    private ApiModels.ResumeResult buildSyntheticResumeResult(StateModels.ProjectState project, StateModels.UserAccount user, String jobId) {
        String locale = normalizeLocale(project.locale);
        String companyName = defaultCompany(project.companyName);
        List<String> jdKeywords = extractKeywords(project.jdText, 12);
        List<String> resumeKeywords = extractKeywords(project.resumeText, 12);
        Set<String> merged = new LinkedHashSet<>();
        merged.addAll(jdKeywords);
        merged.addAll(resumeKeywords);
        List<String> matchedKeywords = jdKeywords.stream()
            .filter(keyword -> resumeKeywords.stream().anyMatch(item -> item.equalsIgnoreCase(keyword)))
            .limit(10)
            .toList();

        List<String> primarySkills = merged.stream().limit(6).toList();
        List<String> secondarySkills = merged.stream().skip(6).limit(4).toList();
        if (primarySkills.isEmpty()) {
            primarySkills = List.of("React", "TypeScript", "工程化", "性能优化");
        }
        if (secondarySkills.isEmpty()) {
            secondarySkills = List.of("Node.js", "Vite", "组件设计");
        }

        int overlap = (int) resumeKeywords.stream().filter(jdKeywords::contains).count();
        int matchScore = Math.min(97, 68 + overlap * 5 + (project.usedReferenceImage ? 3 : 0));

        String displayName = extractCandidateName(project.resumeText, user.displayName);
        String yearsOfExperience = extractYears(project.resumeText);
        ApiModels.CandidateProfile candidateProfile = new ApiModels.CandidateProfile(
            displayName,
            user.headline,
            locale.equals("en") ? "Shanghai, China" : "上海",
            user.email,
            extractPhone(project.resumeText),
            yearsOfExperience,
            locale.equals("en") ? "Frontend Engineer / Growth Platform" : "前端开发 / 增长平台",
            locale.equals("en") ? "Employed, available within 1 month" : "在职，月内到岗"
        );

        List<ApiModels.ResumeExperience> experiences = List.of(
            new ApiModels.ResumeExperience(
                locale.equals("en") ? "Senior Frontend Engineer" : "高级前端工程师",
                companyName,
                locale.equals("en") ? "2023 - Present" : "2023 - 至今",
                locale.equals("en") ? "Led critical user-facing flows and delivery efficiency." : "主导核心业务投递链路与前端工程效率建设。",
                List.of(
                    locale.equals("en") ? "Built reusable modules aligned with hiring keywords." : "围绕 JD 关键词重构经历描述，使项目成果更贴近岗位画像。",
                    locale.equals("en") ? "Improved load performance and ATS readability." : "完成首屏性能优化与 ATS 可读性优化，提升筛选通过率。",
                    locale.equals("en") ? "Coordinated with product and design on iteration strategy." : "与产品、设计协作，建立可复用模板和内容策略。"
                )
            ),
            new ApiModels.ResumeExperience(
                locale.equals("en") ? "Frontend Engineer" : "前端工程师",
                locale.equals("en") ? "Growth Platform Team" : "增长平台团队",
                locale.equals("en") ? "2021 - 2023" : "2021 - 2023",
                locale.equals("en") ? "Focused on dashboard, data analysis, and engineering stability." : "负责中后台、分析平台和工程化基础建设。",
                List.of(
                    locale.equals("en") ? "Implemented componentized dashboard experiences." : "搭建组件化中后台页面，支持多业务快速复用。",
                    locale.equals("en") ? "Introduced build and monitoring improvements." : "推动构建、监控和质量治理，降低线上回归风险。"
                )
            )
        );

        List<ApiModels.ResumeProject> projects = List.of(
            new ApiModels.ResumeProject(
                locale.equals("en") ? "JD-tailored Resume Workflow" : "JD 定制简历工作流",
                locale.equals("en") ? "Owner" : "负责人",
                locale.equals("en") ? "2025" : "2025",
                companyName,
                List.of(
                    locale.equals("en") ? "Extracted ATS keywords and aligned resume language with job requirements." : "提取 ATS 关键词，并以岗位语言体系重写简历内容。",
                    locale.equals("en") ? "Delivered multi-template output with shareable previews." : "支持多模板输出与可分享预览，提升投递效率。"
                )
            ),
            new ApiModels.ResumeProject(
                locale.equals("en") ? "Hiring Insights Dashboard" : "招聘洞察分析平台",
                locale.equals("en") ? "Core Contributor" : "核心开发",
                locale.equals("en") ? "2024" : "2024",
                locale.equals("en") ? "Internal Platform" : "内部平台",
                List.of(
                    locale.equals("en") ? "Built metrics views for conversion and resume quality." : "建设转化率、简历质量相关分析看板，支持策略迭代。",
                    locale.equals("en") ? "Enabled component reuse across business scenarios." : "沉淀通用模块，降低新增业务场景接入成本。"
                )
            )
        );

        List<ApiModels.EducationItem> education = List.of(
            new ApiModels.EducationItem(
                locale.equals("en") ? "Tongji University" : "同济大学",
                locale.equals("en") ? "Computer Science" : "计算机科学与技术",
                locale.equals("en") ? "2016 - 2020" : "2016 - 2020",
                locale.equals("en") ? "Bachelor" : "本科"
            )
        );

        List<String> suggestions = List.of(
            locale.equals("en") ? "[summary] Add one more quantified business outcome to the top summary." : "[summary] 在个人总结中补充一条量化业务结果，提升第一屏说服力。",
            locale.equals("en") ? "[experience] Make the timeline more specific with month-level periods." : "[experience] 将工作经历时间线细化到月份，提升 ATS 解析和稳定性判断。",
            locale.equals("en") ? "[skills.primary] Move the highest-signal JD keywords into the primary skills block." : "[skills.primary] 把最高优先级的 JD 关键词前置到核心技能模块。",
            locale.equals("en") ? "[projects] Keep the project bullets concise and recruiter-friendly." : "[projects] 精简项目要点，保留结果和职责，减少冗余表述。"
        );

        String summary = locale.equals("en")
            ? "%s years of frontend experience with strong delivery on %s, engineering quality, and ATS-friendly storytelling."
            .formatted(yearsOfExperience, String.join(", ", primarySkills.stream().limit(4).toList()))
            : "%s前端开发经验，擅长%s等方向，能够围绕 JD 关键词重组项目经历与技能表述，兼顾 ATS 友好度与招聘方阅读效率。"
            .formatted(yearsOfExperience, String.join("、", primarySkills.stream().limit(4).toList()));

        String personalEvaluation = locale.equals("en")
            ? "Result-oriented engineer with strong product empathy, architecture awareness, and a bias for measurable delivery."
            : "结果导向，兼具产品理解、工程化能力与复杂项目推进经验，能够快速贴合目标岗位的能力画像。";

        return new ApiModels.ResumeResult(
            jobId,
            companyName,
            matchScore,
            locale,
            defaultTemplate(project.templateId),
            normalizeModules(project.selectedModules),
            new ApiModels.ResumeSkills(primarySkills, secondarySkills),
            summary,
            matchedKeywords.isEmpty() ? jdKeywords.stream().limit(8).toList() : matchedKeywords,
            jdKeywords,
            suggestions,
            experiences,
            projects,
            education,
            personalEvaluation,
            candidateProfile,
            1,
            project.usedReferenceImage
        );
    }

    private ApiModels.ResumeResult buildResumeResultWithQwen(StateModels.ProjectState project,
                                                             StateModels.UserAccount user,
                                                             String jobId,
                                                             ApiModels.ResumeResult fallback) {
        if (!llmEnabled || !StringUtils.hasText(llmApiKey)) {
            return null;
        }

        try {
            JsonNode generated = requestQwenJson(
                buildQwenSystemPrompt(project.locale),
                buildQwenUserPrompt(project, user, fallback)
            );
            if (generated == null) {
                return null;
            }
            return mergeGeneratedResume(jobId, project, user, fallback, generated);
        } catch (Exception exception) {
            log.warn("Falling back to synthetic resume generation because Qwen request failed", exception);
            return null;
        }
    }

    private ApiModels.ResumeResult mergeGeneratedResume(String jobId,
                                                        StateModels.ProjectState project,
                                                        StateModels.UserAccount user,
                                                        ApiModels.ResumeResult fallback,
                                                        JsonNode generated) {
        JsonNode profileNode = generated.path("candidateProfile");
        JsonNode skillsNode = generated.path("skills");

        List<String> jobKeywords = normalizeStringList(readStringList(generated.path("jobKeywords"), fallback.jobKeywords()), 16);
        List<String> atsKeywords = normalizeStringList(readStringList(generated.path("atsKeywords"), fallback.atsKeywords()), 12);
        List<String> suggestions = normalizeStringList(readStringList(generated.path("suggestions"), fallback.suggestions()), 8);

        return new ApiModels.ResumeResult(
            jobId,
            fallback.companyName(),
            Math.max(55, Math.min(98, generated.path("matchScore").asInt(fallback.matchScore()))),
            fallback.locale(),
            fallback.templateId(),
            fallback.selectedModules(),
            new ApiModels.ResumeSkills(
                normalizeStringList(readStringList(skillsNode.path("primary"), fallback.skills().primary()), 6),
                normalizeStringList(readStringList(skillsNode.path("secondary"), fallback.skills().secondary()), 6)
            ),
            readText(generated, "summary", fallback.summary()),
            atsKeywords,
            jobKeywords,
            suggestions,
            readExperiences(generated.path("experiences"), fallback.experiences()),
            readProjects(generated.path("projects"), fallback.projects()),
            readEducation(generated.path("education"), fallback.education()),
            readText(generated, "personalEvaluation", fallback.personalEvaluation()),
            new ApiModels.CandidateProfile(
                readText(profileNode, "displayName", fallback.candidateProfile().displayName()),
                readText(profileNode, "title", fallback.candidateProfile().title()),
                readText(profileNode, "location", fallback.candidateProfile().location()),
                readText(profileNode, "email", fallback.candidateProfile().email()),
                readText(profileNode, "phone", fallback.candidateProfile().phone()),
                readText(profileNode, "yearsOfExperience", fallback.candidateProfile().yearsOfExperience()),
                readText(profileNode, "targetRole", fallback.candidateProfile().targetRole()),
                readText(profileNode, "employmentStatus", fallback.candidateProfile().employmentStatus())
            ),
            fallback.version(),
            fallback.usedReferenceImage()
        );
    }

    private ApiModels.ResumeResult mergePolishedResume(String jobId,
                                                       StateModels.ProjectState project,
                                                       ApiModels.ResumeResult fallback,
                                                       JsonNode generated) {
        JsonNode profileNode = generated.path("candidateProfile");
        JsonNode skillsNode = generated.path("skills");
        Set<String> supportedTerms = buildSupportedTerms(project, fallback);
        Set<String> supportedNumbers = extractNumericTokens(project.jdText + "\n" + project.resumeText + "\n" + resumeSupportText(fallback));
        List<ApiModels.ResumeExperience> generatedExperiences = readExperiences(generated.path("experiences"), fallback.experiences());
        List<ApiModels.ResumeProject> generatedProjects = readProjects(generated.path("projects"), fallback.projects());

        return new ApiModels.ResumeResult(
            jobId,
            fallback.companyName(),
            Math.max(55, Math.min(98, generated.path("matchScore").asInt(fallback.matchScore()))),
            fallback.locale(),
            fallback.templateId(),
            fallback.selectedModules(),
            new ApiModels.ResumeSkills(
                filterSupportedStrings(readStringList(skillsNode.path("primary"), fallback.skills().primary()), supportedTerms, fallback.skills().primary(), 6),
                filterSupportedStrings(readStringList(skillsNode.path("secondary"), fallback.skills().secondary()), supportedTerms, fallback.skills().secondary(), 6)
            ),
            sanitizePolishedText(readText(generated, "summary", fallback.summary()), fallback.summary(), supportedNumbers),
            filterSupportedStrings(readStringList(generated.path("atsKeywords"), fallback.atsKeywords()), supportedTerms, fallback.atsKeywords(), 12),
            filterSupportedStrings(readStringList(generated.path("jobKeywords"), fallback.jobKeywords()), supportedTerms, fallback.jobKeywords(), 16),
            normalizeStringList(readStringList(generated.path("suggestions"), fallback.suggestions()), 8),
            mergePolishedExperiences(fallback.experiences(), generatedExperiences, supportedNumbers, supportedTerms),
            mergePolishedProjects(fallback.projects(), generatedProjects, supportedNumbers, supportedTerms),
            fallback.education(),
            sanitizePolishedText(readText(generated, "personalEvaluation", fallback.personalEvaluation()), fallback.personalEvaluation(), supportedNumbers),
            new ApiModels.CandidateProfile(
                fallback.candidateProfile().displayName(),
                sanitizePolishedText(readText(profileNode, "title", fallback.candidateProfile().title()), fallback.candidateProfile().title(), supportedNumbers),
                fallback.candidateProfile().location(),
                fallback.candidateProfile().email(),
                fallback.candidateProfile().phone(),
                fallback.candidateProfile().yearsOfExperience(),
                sanitizePolishedText(readText(profileNode, "targetRole", fallback.candidateProfile().targetRole()), fallback.candidateProfile().targetRole(), supportedNumbers),
                fallback.candidateProfile().employmentStatus()
            ),
            fallback.version(),
            fallback.usedReferenceImage()
        );
    }

    private String buildQwenSystemPrompt(String locale) {
        return """
            你是一名资深招聘经理和简历顾问。请根据原始简历与目标JD输出一个纯 JSON 对象。
            绝对不要输出 Markdown、解释、代码块或额外文本。
            必须包含以下键：
            {
              "matchScore": 0-100的整数,
              "candidateProfile": {
                "displayName": "",
                "title": "",
                "location": "",
                "email": "",
                "phone": "",
                "yearsOfExperience": "",
                "targetRole": "",
                "employmentStatus": ""
              },
              "summary": "",
              "skills": {
                "primary": [],
                "secondary": []
              },
              "atsKeywords": [],
              "jobKeywords": [],
              "suggestions": [],
              "experiences": [
                {
                  "title": "",
                  "company": "",
                  "period": "",
                  "highlights": "",
                  "bullets": []
                }
              ],
              "projects": [
                {
                  "name": "",
                  "role": "",
                  "period": "",
                  "organization": "",
                  "bullets": []
                }
              ],
              "education": [
                {
                  "school": "",
                  "major": "",
                  "period": "",
                  "degree": ""
                }
              ],
              "personalEvaluation": ""
            }

            生成要求：
            1. 内容语言必须与 locale 一致；如果 locale=en，则 JSON 值使用英文。
            2. 不要虚构原始简历中不存在的具体公司、学校、证书；信息不足时使用保守泛化表达。
            3. atsKeywords 只放已经能被候选人经历、项目或技能支撑的命中词。
            4. jobKeywords 提取 10-15 个与 JD 高度相关的关键词。
            5. suggestions 每一项必须使用 "[field] 建议内容" 格式，field 只能从 summary、experience、skills.primary、education、projects、highlights 中选择。
            6. experiences 输出 2-4 条，projects 输出 2-4 条，education 输出 1-2 条。
            7. JSON 中必须包含字符串或数组，不要输出 null。
            """;
    }

    private String buildQwenPolishSystemPrompt(String locale) {
        return """
            你是一名资深招聘经理和简历顾问。你将收到一份当前简历 JSON、目标 JD、原始简历文本和用户的润色要求。
            你的任务是基于用户要求对当前简历做定向润色，输出一个纯 JSON 对象。
            绝对不要输出 Markdown、解释、代码块或额外文本。
            必须包含以下键：
            {
              "matchScore": 0-100的整数,
              "candidateProfile": {
                "displayName": "",
                "title": "",
                "location": "",
                "email": "",
                "phone": "",
                "yearsOfExperience": "",
                "targetRole": "",
                "employmentStatus": ""
              },
              "summary": "",
              "skills": {
                "primary": [],
                "secondary": []
              },
              "atsKeywords": [],
              "jobKeywords": [],
              "suggestions": [],
              "experiences": [
                {
                  "title": "",
                  "company": "",
                  "period": "",
                  "highlights": "",
                  "bullets": []
                }
              ],
              "projects": [
                {
                  "name": "",
                  "role": "",
                  "period": "",
                  "organization": "",
                  "bullets": []
                }
              ],
              "education": [
                {
                  "school": "",
                  "major": "",
                  "period": "",
                  "degree": ""
                }
              ],
              "personalEvaluation": ""
            }

            润色要求：
            1. 内容语言必须与 locale 一致；如果 locale=en，则 JSON 值使用英文。
            2. 严格保留已有事实，不要虚构新的公司、学校、证书、年份、业务成果或指标。
            3. 可以重写表达、调整措辞顺序、突出关键词、压缩冗余信息，但不能改写事实。
            4. 用户要求优先级最高；若用户要求与事实冲突，则保持事实并用更稳妥的表达贴近要求。
            5. suggestions 每一项必须使用 "[field] 建议内容" 格式，field 只能从 summary、experience、skills.primary、education、projects、highlights 中选择。
            6. JSON 中必须包含字符串或数组，不要输出 null。
            """;
    }

    private String buildQwenUserPrompt(StateModels.ProjectState project,
                                       StateModels.UserAccount user,
                                       ApiModels.ResumeResult fallback) {
        return """
            请输出 JSON。

            locale: %s
            companyName: %s
            userDisplayName: %s
            userHeadline: %s
            selectedModules: %s
            templateId: %s

            targetJD:
            %s

            sourceResume:
            %s

            fallbackSummary:
            %s
            """.formatted(
            normalizeLocale(project.locale),
            defaultCompany(project.companyName),
            user.displayName,
            user.headline,
            String.join(", ", normalizeModules(project.selectedModules)),
            defaultTemplate(project.templateId),
            project.jdText,
            project.resumeText,
            fallback.summary()
        );
    }

    private String buildQwenPolishUserPrompt(StateModels.ProjectState project,
                                             StateModels.UserAccount user,
                                             ApiModels.ResumeResult currentResume,
                                             String instruction) {
        try {
            return """
                请输出 JSON。

                locale: %s
                companyName: %s
                userDisplayName: %s
                userHeadline: %s
                selectedModules: %s
                templateId: %s

                userInstruction:
                %s

                targetJD:
                %s

                sourceResume:
                %s

                currentResumeJson:
                %s
                """.formatted(
                normalizeLocale(project.locale),
                defaultCompany(project.companyName),
                user.displayName,
                user.headline,
                String.join(", ", normalizeModules(project.selectedModules)),
                defaultTemplate(project.templateId),
                instruction,
                project.jdText,
                project.resumeText,
                objectMapper.writeValueAsString(currentResume)
            );
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "构建润色提示词失败");
        }
    }

    private JsonNode requestQwenJson(String systemPrompt, String userPrompt) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", llmModel);
            payload.put("temperature", 0.35);
            payload.put("response_format", Map.of("type", "json_object"));
            payload.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userPrompt)
            ));

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(resolveChatCompletionsUrl()))
                .timeout(Duration.ofSeconds(90))
                .header("Authorization", "Bearer " + llmApiKey.trim())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                log.warn("Qwen request failed with status {}: {}", response.statusCode(), response.body());
                return null;
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
            String content = extractMessageContent(contentNode);
            if (!StringUtils.hasText(content)) {
                log.warn("Qwen response did not contain usable content: {}", response.body());
                return null;
            }

            return objectMapper.readTree(stripJsonFence(content));
        } catch (Exception exception) {
            log.warn("Qwen request failed", exception);
            return null;
        }
    }

    private List<ApiModels.ResumeExperience> mergePolishedExperiences(List<ApiModels.ResumeExperience> fallback,
                                                                      List<ApiModels.ResumeExperience> generated,
                                                                      Set<String> supportedNumbers,
                                                                      Set<String> supportedTerms) {
        if (fallback.isEmpty()) {
            return generated.stream()
                .map(item -> new ApiModels.ResumeExperience(
                    item.title(),
                    item.company(),
                    item.period(),
                    sanitizePolishedText(item.highlights(), item.highlights(), supportedNumbers),
                    sanitizePolishedBullets(item.bullets(), item.bullets(), supportedNumbers, supportedTerms)
                ))
                .toList();
        }

        List<ApiModels.ResumeExperience> merged = new ArrayList<>();
        for (int index = 0; index < fallback.size(); index += 1) {
            ApiModels.ResumeExperience current = fallback.get(index);
            ApiModels.ResumeExperience candidate = index < generated.size() ? generated.get(index) : current;
            merged.add(new ApiModels.ResumeExperience(
                current.title(),
                current.company(),
                current.period(),
                sanitizePolishedText(candidate.highlights(), current.highlights(), supportedNumbers, supportedTerms),
                sanitizePolishedBullets(candidate.bullets(), current.bullets(), supportedNumbers, supportedTerms)
            ));
        }
        return merged;
    }

    private List<ApiModels.ResumeProject> mergePolishedProjects(List<ApiModels.ResumeProject> fallback,
                                                                List<ApiModels.ResumeProject> generated,
                                                                Set<String> supportedNumbers,
                                                                Set<String> supportedTerms) {
        if (fallback.isEmpty()) {
            return generated.stream()
                .map(item -> new ApiModels.ResumeProject(
                    item.name(),
                    item.role(),
                    item.period(),
                    item.organization(),
                    sanitizePolishedBullets(item.bullets(), item.bullets(), supportedNumbers, supportedTerms)
                ))
                .toList();
        }

        List<ApiModels.ResumeProject> merged = new ArrayList<>();
        for (int index = 0; index < fallback.size(); index += 1) {
            ApiModels.ResumeProject current = fallback.get(index);
            ApiModels.ResumeProject candidate = index < generated.size() ? generated.get(index) : current;
            merged.add(new ApiModels.ResumeProject(
                current.name(),
                current.role(),
                current.period(),
                current.organization(),
                sanitizePolishedBullets(candidate.bullets(), current.bullets(), supportedNumbers, supportedTerms)
            ));
        }
        return merged;
    }

    private List<String> sanitizePolishedBullets(List<String> generated,
                                                 List<String> fallback,
                                                 Set<String> supportedNumbers,
                                                 Set<String> supportedTerms) {
        List<String> values = new ArrayList<>();
        int max = Math.max(generated != null ? generated.size() : 0, fallback != null ? fallback.size() : 0);
        for (int index = 0; index < max; index += 1) {
            String generatedValue = generated != null && index < generated.size() ? generated.get(index) : "";
            String fallbackValue = fallback != null && index < fallback.size() ? fallback.get(index) : "";
            String sanitized = sanitizePolishedText(generatedValue, fallbackValue, supportedNumbers, supportedTerms);
            if (StringUtils.hasText(sanitized)) {
                values.add(sanitized);
            }
        }
        return values.isEmpty() ? fallback : values;
    }

    private String sanitizePolishedText(String generated, String fallback, Set<String> supportedNumbers) {
        if (!StringUtils.hasText(generated)) {
            return fallback;
        }
        String trimmed = generated.trim();
        return containsUnsupportedNumbers(trimmed, supportedNumbers) ? fallback : trimmed;
    }

    private String sanitizePolishedText(String generated,
                                        String fallback,
                                        Set<String> supportedNumbers,
                                        Set<String> supportedTerms) {
        String trimmed = sanitizePolishedText(generated, fallback, supportedNumbers);
        return hasInsufficientSupport(trimmed, supportedTerms) ? fallback : trimmed;
    }

    private boolean containsUnsupportedNumbers(String text, Set<String> supportedNumbers) {
        if (!StringUtils.hasText(text)) {
            return false;
        }
        Matcher matcher = Pattern.compile("\\d+(?:\\.\\d+)?%?\\+?").matcher(text);
        while (matcher.find()) {
            if (!supportedNumbers.contains(matcher.group())) {
                return true;
            }
        }
        return false;
    }

    private Set<String> buildSupportedTerms(StateModels.ProjectState project, ApiModels.ResumeResult resume) {
        return extractSupportedTerms(project.jdText + "\n" + project.resumeText + "\n" + resumeSupportText(resume));
    }

    private Set<String> extractSupportedTerms(String text) {
        LinkedHashSet<String> values = new LinkedHashSet<>();
        Matcher matcher = TOKEN_PATTERN.matcher(defaultText(text, ""));
        while (matcher.find()) {
            String token = matcher.group().trim().toLowerCase(Locale.ROOT);
            if (token.length() >= 2) {
                values.add(token);
            }
        }
        return values;
    }

    private Set<String> extractNumericTokens(String text) {
        LinkedHashSet<String> values = new LinkedHashSet<>();
        Matcher matcher = Pattern.compile("\\d+(?:\\.\\d+)?%?\\+?").matcher(defaultText(text, ""));
        while (matcher.find()) {
            values.add(matcher.group());
        }
        return values;
    }

    private String resumeSupportText(ApiModels.ResumeResult resume) {
        return String.join("\n",
            defaultText(resume.summary(), ""),
            String.join("\n", resume.skills().primary()),
            String.join("\n", resume.skills().secondary()),
            resume.experiences().stream()
                .map(item -> String.join("\n", item.title(), item.company(), item.period(), item.highlights(), String.join("\n", item.bullets())))
                .collect(Collectors.joining("\n")),
            resume.projects().stream()
                .map(item -> String.join("\n", item.name(), item.role(), item.period(), item.organization(), String.join("\n", item.bullets())))
                .collect(Collectors.joining("\n")),
            resume.education().stream()
                .map(item -> String.join("\n", item.school(), item.degree(), item.major(), item.period()))
                .collect(Collectors.joining("\n")),
            defaultText(resume.personalEvaluation(), ""),
            defaultText(resume.candidateProfile().title(), ""),
            defaultText(resume.candidateProfile().targetRole(), "")
        );
    }

    private List<String> filterSupportedStrings(List<String> generated,
                                                Set<String> supportedTerms,
                                                List<String> fallback,
                                                int maxSize) {
        List<String> filtered = normalizeStringList(generated, maxSize).stream()
            .filter(value -> isSupportedPhrase(value, supportedTerms))
            .limit(Math.max(maxSize, 1))
            .toList();
        return filtered.isEmpty() ? normalizeStringList(fallback, maxSize) : filtered;
    }

    private boolean isSupportedPhrase(String value, Set<String> supportedTerms) {
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (!StringUtils.hasText(normalized)) {
            return false;
        }
        return supportedTerms.stream().anyMatch(term -> normalized.contains(term) || term.contains(normalized));
    }

    private boolean hasInsufficientSupport(String value, Set<String> supportedTerms) {
        List<String> tokens = extractSupportedTerms(value).stream().toList();
        if (tokens.isEmpty()) {
            return false;
        }
        long supportedCount = tokens.stream()
            .filter(token -> supportedTerms.stream().anyMatch(term -> token.contains(term) || term.contains(token)))
            .count();
        return ((double) supportedCount / tokens.size()) < 0.6d;
    }

    private ApiModels.ResumeResult normalizeResumeForPolish(StateModels.JobState job, ApiModels.PolishResumeRequest request) {
        ApiModels.ResumeResult current = request.resumeData() != null ? request.resumeData() : job.result;
        ApiModels.CandidateProfile profile = request.candidateProfile() != null
            ? request.candidateProfile()
            : (current.candidateProfile() != null ? current.candidateProfile() : job.result.candidateProfile());
        List<String> selectedModules = normalizeModules(
            current.selectedModules() != null ? current.selectedModules() : job.result.selectedModules()
        );
        String templateId = defaultTemplate(current.templateId());
        return new ApiModels.ResumeResult(
            job.id,
            defaultCompany(current.companyName()),
            Math.max(current.matchScore(), 0),
            normalizeLocale(current.locale()),
            templateId,
            selectedModules,
            current.skills() != null ? current.skills() : job.result.skills(),
            defaultText(current.summary(), job.result.summary()),
            normalizeStringList(current.atsKeywords() != null ? current.atsKeywords() : job.result.atsKeywords(), 12),
            normalizeStringList(current.jobKeywords() != null ? current.jobKeywords() : job.result.jobKeywords(), 16),
            normalizeStringList(current.suggestions() != null ? current.suggestions() : job.result.suggestions(), 8),
            current.experiences() != null ? current.experiences() : List.of(),
            current.projects() != null ? current.projects() : List.of(),
            current.education() != null ? current.education() : List.of(),
            defaultText(current.personalEvaluation(), job.result.personalEvaluation()),
            profile,
            Math.max(current.version(), job.result.version()),
            current.usedReferenceImage()
        );
    }

    private String resolveChatCompletionsUrl() {
        String trimmed = llmBaseUrl.trim();
        return trimmed.endsWith("/chat/completions") ? trimmed : trimmed.replaceAll("/+$", "") + "/chat/completions";
    }

    private String extractMessageContent(JsonNode contentNode) {
        if (contentNode == null || contentNode.isMissingNode() || contentNode.isNull()) {
            return null;
        }
        if (contentNode.isTextual()) {
            return contentNode.asText();
        }
        if (contentNode.isArray()) {
            StringBuilder builder = new StringBuilder();
            for (JsonNode node : contentNode) {
                if (node.has("text")) {
                    builder.append(node.path("text").asText());
                } else if (node.has("content")) {
                    builder.append(node.path("content").asText());
                } else if (node.isTextual()) {
                    builder.append(node.asText());
                }
            }
            return builder.toString();
        }
        return contentNode.toString();
    }

    private String stripJsonFence(String value) {
        String trimmed = value.trim();
        if (trimmed.startsWith("```")) {
            trimmed = trimmed.replaceFirst("^```(?:json)?", "").trim();
        }
        if (trimmed.endsWith("```")) {
            trimmed = trimmed.substring(0, trimmed.length() - 3).trim();
        }
        return trimmed;
    }

    private String readText(JsonNode node, String field, String fallback) {
        if (node == null || node.isMissingNode()) {
            return fallback;
        }
        String value = node.path(field).asText("");
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private List<String> readStringList(JsonNode node, List<String> fallback) {
        if (node == null || !node.isArray()) {
            return fallback;
        }
        List<String> values = new ArrayList<>();
        node.forEach(item -> {
            String value = item.asText("").trim();
            if (StringUtils.hasText(value)) {
                values.add(value);
            }
        });
        return values.isEmpty() ? fallback : values;
    }

    private List<String> normalizeStringList(List<String> values, int maxSize) {
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        values.forEach(value -> {
            if (StringUtils.hasText(value)) {
                normalized.add(value.trim());
            }
        });
        return normalized.stream().limit(Math.max(maxSize, 1)).toList();
    }

    private List<ApiModels.ResumeExperience> readExperiences(JsonNode node, List<ApiModels.ResumeExperience> fallback) {
        if (node == null || !node.isArray()) {
            return fallback;
        }
        List<ApiModels.ResumeExperience> values = new ArrayList<>();
        node.forEach(item -> {
            values.add(new ApiModels.ResumeExperience(
                readText(item, "title", ""),
                readText(item, "company", ""),
                readText(item, "period", ""),
                readText(item, "highlights", ""),
                normalizeStringList(readStringList(item.path("bullets"), List.of()), 6)
            ));
        });
        List<ApiModels.ResumeExperience> filtered = values.stream()
            .filter(item -> StringUtils.hasText(item.title()) || StringUtils.hasText(item.company()))
            .toList();
        return filtered.isEmpty() ? fallback : filtered;
    }

    private List<ApiModels.ResumeProject> readProjects(JsonNode node, List<ApiModels.ResumeProject> fallback) {
        if (node == null || !node.isArray()) {
            return fallback;
        }
        List<ApiModels.ResumeProject> values = new ArrayList<>();
        node.forEach(item -> {
            values.add(new ApiModels.ResumeProject(
                readText(item, "name", ""),
                readText(item, "role", ""),
                readText(item, "period", ""),
                readText(item, "organization", ""),
                normalizeStringList(readStringList(item.path("bullets"), List.of()), 6)
            ));
        });
        List<ApiModels.ResumeProject> filtered = values.stream()
            .filter(item -> StringUtils.hasText(item.name()) || StringUtils.hasText(item.organization()))
            .toList();
        return filtered.isEmpty() ? fallback : filtered;
    }

    private List<ApiModels.EducationItem> readEducation(JsonNode node, List<ApiModels.EducationItem> fallback) {
        if (node == null || !node.isArray()) {
            return fallback;
        }
        List<ApiModels.EducationItem> values = new ArrayList<>();
        node.forEach(item -> {
            values.add(new ApiModels.EducationItem(
                readText(item, "school", ""),
                readText(item, "major", ""),
                readText(item, "period", ""),
                readText(item, "degree", "")
            ));
        });
        List<ApiModels.EducationItem> filtered = values.stream()
            .filter(item -> StringUtils.hasText(item.school()) || StringUtils.hasText(item.major()))
            .toList();
        return filtered.isEmpty() ? fallback : filtered;
    }

    private void seedSharedResume(StateModels.UserAccount user, String companyName, String headline, String jd) {
        StateModels.ProjectState project = new StateModels.ProjectState();
        project.id = IdGenerator.next("prj_");
        project.userId = user.id;
        project.companyName = companyName;
        project.locale = "zh";
        project.jdText = jd;
        project.resumeText = "5年+ 前端开发经验，精通 React/Vue3/TypeScript，主导过中后台与增长平台项目建设。";
        project.selectedModules = List.copyOf(DEFAULT_MODULES);
        project.templateId = switch (companyName) {
            case "阿里巴巴" -> "classic";
            case "字节跳动" -> "modern";
            case "腾讯" -> "professional";
            default -> "gradient";
        };
        project.createdAt = Instant.now().minusSeconds((long) (Math.random() * 50000));
        store.projects.put(project.id, project);

        StateModels.JobState job = new StateModels.JobState();
        job.id = IdGenerator.next("job_");
        job.projectId = project.id;
        job.userId = user.id;
        job.status = "SUCCEEDED";
        job.progress = 100;
        job.createdAt = project.createdAt.plusSeconds(30);
        job.updatedAt = job.createdAt;
        job.result = buildSyntheticResumeResult(project, user, job.id);
        store.jobs.put(job.id, job);
        project.latestJobId = job.id;

        StateModels.SharedResumeState sharedResume = new StateModels.SharedResumeState();
        sharedResume.id = IdGenerator.next("share_");
        sharedResume.jobId = job.id;
        sharedResume.userId = user.id;
        sharedResume.createdAt = job.updatedAt.plusSeconds(30);
        sharedResume.viewCount = 40 + (long) (Math.random() * 160);
        sharedResume.useCount = 8 + (long) (Math.random() * 25);
        store.sharedResumes.put(sharedResume.id, sharedResume);
    }

    private synchronized StateModels.OrderState createPaidOrder(String userId, StateModels.RedemptionProductState product) {
        StateModels.OrderState order = new StateModels.OrderState();
        order.id = IdGenerator.next("ord_");
        order.userId = userId;
        order.productId = product.id;
        order.productType = product.productType;
        order.title = product.name;
        order.amountCent = product.priceCent;
        order.credits = product.credits;
        order.grantsPro = product.grantsPro;
        order.status = "PAID";
        order.createdAt = Instant.now();
        store.orders.put(order.id, order);
        return order;
    }

    private StateModels.RedemptionCodeState createRedemptionCode(StateModels.RedemptionProductState product,
                                                                 String purchasedByUserId,
                                                                 String orderId) {
        StateModels.RedemptionCodeState code = new StateModels.RedemptionCodeState();
        code.id = IdGenerator.next("rcode_");
        code.code = ("CRS-" + code.id.substring(Math.max(0, code.id.length() - 6))).toUpperCase(Locale.ROOT);
        code.productId = product.id;
        code.productType = product.productType;
        code.productName = product.name;
        code.credits = product.credits;
        code.grantsPro = product.grantsPro;
        code.status = StringUtils.hasText(purchasedByUserId) ? "PURCHASED" : "AVAILABLE";
        code.createdAt = Instant.now();
        code.purchasedByUserId = purchasedByUserId;
        code.orderId = orderId;
        store.redemptionCodes.put(code.id, code);
        return code;
    }

    private void mergeProject(StateModels.ProjectState project, ApiModels.GenerateRequest request, MultipartFile image) {
        project.companyName = defaultCompany(request.companyName());
        project.locale = normalizeLocale(request.locale());
        project.jdText = defaultText(request.jdText(), project.jdText);
        project.resumeText = defaultText(request.resumeText(), project.resumeText);
        project.selectedModules = normalizeModules(request.selectedModules());
        project.templateId = defaultTemplate(request.templateId());
        project.usedReferenceImage = image != null && !image.isEmpty();
        project.referenceImageName = project.usedReferenceImage ? image.getOriginalFilename() : null;
    }

    private ApiModels.ResumeResult withTemplate(ApiModels.ResumeResult result, String templateId) {
        return new ApiModels.ResumeResult(
            result.jobId(),
            result.companyName(),
            result.matchScore(),
            result.locale(),
            templateId,
            normalizeModules(result.selectedModules()),
            result.skills(),
            result.summary(),
            result.atsKeywords(),
            result.jobKeywords(),
            result.suggestions(),
            result.experiences(),
            result.projects(),
            result.education(),
            result.personalEvaluation(),
            result.candidateProfile(),
            result.version() + 1,
            result.usedReferenceImage()
        );
    }

    private StateModels.ProjectState requireProjectOwned(String userId, String projectId) {
        StateModels.ProjectState project = store.projects.get(projectId);
        if (project == null || !project.userId.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "项目不存在");
        }
        return project;
    }

    private StateModels.JobState requireJobOwned(String userId, String jobId) {
        StateModels.JobState job = requireJob(jobId);
        if (!job.userId.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "任务不存在");
        }
        return job;
    }

    private StateModels.JobState requireJob(String jobId) {
        StateModels.JobState job = store.jobs.get(jobId);
        if (job == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "任务不存在");
        }
        return job;
    }

    private StateModels.SharedResumeState requireSharedResume(String sharedResumeId) {
        StateModels.SharedResumeState sharedResume = store.sharedResumes.get(sharedResumeId);
        if (sharedResume == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "共享简历不存在");
        }
        return sharedResume;
    }

    private StateModels.OrderState requireOrderOwned(String userId, String orderId) {
        StateModels.OrderState order = store.orders.get(orderId);
        if (order == null || !order.userId.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在");
        }
        return order;
    }

    private StateModels.RedemptionCodeState requireRedemptionCode(String codeId) {
        StateModels.RedemptionCodeState code = store.redemptionCodes.get(codeId);
        if (code == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "兑换码不存在");
        }
        return code;
    }

    private StateModels.RedemptionProductState requireProduct(String productId) {
        return store.redemptionProducts.stream()
            .filter(item -> item.id.equals(productId) && item.active)
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "商品不存在"));
    }

    private StateModels.ChatSessionState requireChatSessionOwned(String userId, String sessionId) {
        StateModels.ChatSessionState session = store.chatSessions.get(sessionId);
        if (session == null || !session.userId.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "会话不存在");
        }
        return session;
    }

    private ApiModels.ProjectView toProjectView(StateModels.ProjectState project) {
        return new ApiModels.ProjectView(
            project.id,
            project.companyName,
            project.locale,
            project.jdText,
            project.resumeText,
            project.selectedModules,
            project.templateId,
            project.usedReferenceImage,
            project.createdAt,
            project.latestJobId
        );
    }

    private ApiModels.JobView toJobView(StateModels.JobState job) {
        return new ApiModels.JobView(
            job.id,
            job.projectId,
            job.status,
            job.progress,
            job.result,
            job.errorMessage,
            job.createdAt,
            job.updatedAt
        );
    }

    private ApiModels.SharedResumeView toSharedResumeView(StateModels.SharedResumeState sharedResume, String viewerUserId) {
        StateModels.JobState job = requireJob(sharedResume.jobId);
        ApiModels.ResumeResult result = job.result;
        return new ApiModels.SharedResumeView(
            sharedResume.id,
            result.companyName(),
            result.matchScore(),
            result.templateId(),
            result.locale(),
            result,
            sharedResume.viewCount,
            sharedResume.useCount,
            sharedResume.createdAt,
            viewerUserId != null && viewerUserId.equals(sharedResume.userId)
        );
    }

    private ApiModels.OrderView toOrderView(StateModels.OrderState order) {
        return new ApiModels.OrderView(
            order.id,
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

    private ApiModels.RedemptionCodeView toRedemptionCodeView(StateModels.RedemptionCodeState code) {
        return new ApiModels.RedemptionCodeView(
            code.id,
            code.code,
            code.productId,
            code.productType,
            code.productName,
            code.credits,
            code.grantsPro,
            code.status,
            code.createdAt,
            code.redeemedAt,
            code.orderId
        );
    }

    private ApiModels.ChatSessionView toChatSessionView(StateModels.ChatSessionState session) {
        return new ApiModels.ChatSessionView(session.id, session.title, session.status, session.createdAt, session.updatedAt);
    }

    private ApiModels.ChatMessageView toChatMessageView(StateModels.ChatMessageState message) {
        return new ApiModels.ChatMessageView(message.id, message.role, message.content, message.createdAt);
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

    private List<String> extractKeywords(String text, int limit) {
        if (!StringUtils.hasText(text)) {
            return KNOWN_KEYWORDS.stream().limit(limit).toList();
        }
        Map<String, Long> counts = TOKEN_PATTERN.matcher(text).results()
            .map(MatchResult::group)
            .map(token -> token.replace("：", "").replace("，", "").replace(",", "").trim())
            .filter(StringUtils::hasText)
            .map(this::normalizeKeyword)
            .collect(Collectors.groupingBy(token -> token, Collectors.counting()));

        List<String> prioritized = new ArrayList<>();
        for (String keyword : KNOWN_KEYWORDS) {
            if (text.toLowerCase(Locale.ROOT).contains(keyword.toLowerCase(Locale.ROOT))) {
                prioritized.add(keyword);
            }
        }

        List<String> dynamic = counts.entrySet().stream()
            .filter(entry -> entry.getKey().length() >= 2)
            .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
            .map(Map.Entry::getKey)
            .toList();

        LinkedHashSet<String> ordered = new LinkedHashSet<>();
        ordered.addAll(prioritized);
        ordered.addAll(dynamic);
        return ordered.stream().limit(limit).toList();
    }

    private String normalizeKeyword(String token) {
        return KNOWN_KEYWORDS.stream()
            .filter(keyword -> keyword.equalsIgnoreCase(token))
            .findFirst()
            .orElse(token);
    }

    private String extractCandidateName(String resumeText, String fallback) {
        if (StringUtils.hasText(resumeText)) {
            String firstLine = resumeText.lines().findFirst().orElse("").trim();
            if (firstLine.length() >= 2 && firstLine.length() <= 12) {
                return firstLine;
            }
            Matcher matcher = Pattern.compile("([\\u4e00-\\u9fa5]{2,4})").matcher(firstLine);
            if (matcher.find()) {
                return matcher.group(1);
            }
        }
        return fallback;
    }

    private String extractYears(String resumeText) {
        if (!StringUtils.hasText(resumeText)) {
            return "5年+";
        }
        Matcher matcher = Pattern.compile("(\\d+)\\s*年").matcher(resumeText);
        if (matcher.find()) {
            return matcher.group(1) + "年+";
        }
        return "5年+";
    }

    private String extractPhone(String resumeText) {
        if (!StringUtils.hasText(resumeText)) {
            return "138-0013-8000";
        }
        Matcher matcher = Pattern.compile("(1\\d{10})").matcher(resumeText.replaceAll("\\s+", ""));
        if (matcher.find()) {
            String digits = matcher.group(1);
            return digits.substring(0, 3) + "-" + digits.substring(3, 7) + "-" + digits.substring(7);
        }
        return "138-0013-8000";
    }

    private String defaultCompany(String value) {
        return StringUtils.hasText(value) ? value.trim() : "目标公司";
    }

    private String defaultText(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private List<String> normalizeModules(List<String> modules) {
        if (modules == null || modules.isEmpty()) {
            return List.copyOf(DEFAULT_MODULES);
        }
        return modules.stream()
            .filter(StringUtils::hasText)
            .map(String::trim)
            .distinct()
            .toList();
    }

    private String defaultTemplate(String templateId) {
        return StringUtils.hasText(templateId) ? templateId.trim() : "classic";
    }

    private String normalizeLocale(String locale) {
        return StringUtils.hasText(locale) && locale.equalsIgnoreCase("en") ? "en" : "zh";
    }

    private String requiredText(String value, String message) {
        if (!StringUtils.hasText(value)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
        }
    }
}
