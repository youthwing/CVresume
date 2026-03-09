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
public class SupportController {

    private final PlatformService platformService;

    public SupportController(PlatformService platformService) {
        this.platformService = platformService;
    }

    @PostMapping("/feedback")
    public ApiModels.FeedbackView submitFeedback(@AuthenticationPrincipal AuthUser authUser,
                                                 @RequestBody ApiModels.FeedbackRequest request) {
        return platformService.submitFeedback(authUser, request);
    }

    @GetMapping("/feedback")
    public ApiModels.PageResponse<ApiModels.FeedbackView> feedback(@AuthenticationPrincipal AuthUser authUser,
                                                                   @RequestParam(defaultValue = "0") int page,
                                                                   @RequestParam(defaultValue = "10") int size) {
        return platformService.feedbackList(authUser, page, size);
    }

    @GetMapping("/chat/current")
    public ApiModels.ChatSessionView current(@AuthenticationPrincipal AuthUser authUser) {
        return platformService.currentChat(authUser);
    }

    @GetMapping("/chat/sessions/{sessionId}/messages")
    public List<ApiModels.ChatMessageView> messages(@AuthenticationPrincipal AuthUser authUser,
                                                    @PathVariable String sessionId) {
        return platformService.messages(authUser, sessionId);
    }

    @PostMapping("/chat/sessions/{sessionId}/close")
    public ApiModels.ChatSessionView close(@AuthenticationPrincipal AuthUser authUser,
                                           @PathVariable String sessionId) {
        return platformService.closeChat(authUser, sessionId);
    }

    @GetMapping("/chat/history")
    public ApiModels.ChatHistoryView history(@AuthenticationPrincipal AuthUser authUser,
                                             @RequestParam(required = false) String cursor,
                                             @RequestParam(defaultValue = "10") int size) {
        return platformService.chatHistory(authUser, cursor, size);
    }
}
