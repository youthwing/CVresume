package com.crseume.api;

import com.crseume.domain.ApiModels;
import com.crseume.security.AuthUser;
import com.crseume.service.PlatformService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ProjectController {

    private final PlatformService platformService;

    public ProjectController(PlatformService platformService) {
        this.platformService = platformService;
    }

    @PostMapping("/projects")
    public ApiModels.ProjectView createProject(@AuthenticationPrincipal AuthUser authUser,
                                               @RequestBody ApiModels.CreateProjectRequest request) {
        return platformService.createProject(authUser, request);
    }

    @GetMapping("/projects")
    public List<ApiModels.ProjectView> projects(@AuthenticationPrincipal AuthUser authUser) {
        return platformService.listProjects(authUser);
    }

    @GetMapping("/projects/{projectId}")
    public ApiModels.ProjectView project(@AuthenticationPrincipal AuthUser authUser, @PathVariable String projectId) {
        return platformService.getProject(authUser, projectId);
    }

    @DeleteMapping("/projects/{projectId}")
    public ApiModels.BasicMessage deleteProject(@AuthenticationPrincipal AuthUser authUser, @PathVariable String projectId) {
        platformService.deleteProject(authUser, projectId);
        return new ApiModels.BasicMessage("项目已删除");
    }

    @PostMapping("/projects/{projectId}/generate")
    public ApiModels.JobView generate(@AuthenticationPrincipal AuthUser authUser,
                                      @PathVariable String projectId,
                                      @RequestPart("data") ApiModels.GenerateRequest request,
                                      @RequestPart(value = "image", required = false) MultipartFile image) {
        return platformService.generate(authUser, projectId, request, image);
    }

    @GetMapping("/jobs/{jobId}")
    public ApiModels.JobView job(@AuthenticationPrincipal AuthUser authUser, @PathVariable String jobId) {
        return platformService.getJob(authUser, jobId);
    }

    @GetMapping("/jobs/{jobId}/result")
    public ApiModels.ResumeResult jobResult(@AuthenticationPrincipal AuthUser authUser, @PathVariable String jobId) {
        return platformService.getJobResult(authUser, jobId);
    }

    @PostMapping("/jobs/{jobId}/retry")
    public ApiModels.JobView retry(@AuthenticationPrincipal AuthUser authUser, @PathVariable String jobId) {
        return platformService.retry(authUser, jobId);
    }

    @PatchMapping("/jobs/{jobId}/template")
    public ApiModels.JobView updateTemplate(@AuthenticationPrincipal AuthUser authUser,
                                            @PathVariable String jobId,
                                            @RequestBody ApiModels.UpdateTemplateRequest request) {
        return platformService.updateTemplate(authUser, jobId, request);
    }

    @PutMapping("/jobs/{jobId}/resume-content")
    public ApiModels.ResumeResult updateResumeContent(@AuthenticationPrincipal AuthUser authUser,
                                                      @PathVariable String jobId,
                                                      @RequestBody ApiModels.UpdateResumeContentRequest request) {
        return platformService.updateResumeContent(authUser, jobId, request);
    }

    @PostMapping("/jobs/{jobId}/polish")
    public ApiModels.ResumeResult polishResume(@AuthenticationPrincipal AuthUser authUser,
                                               @PathVariable String jobId,
                                               @RequestBody ApiModels.PolishResumeRequest request) {
        return platformService.polishResume(authUser, jobId, request);
    }

    @PostMapping("/shared-resumes")
    public ApiModels.SharedResumeView createSharedResume(@AuthenticationPrincipal AuthUser authUser,
                                                         @RequestBody ApiModels.CreateSharedResumeRequest request) {
        return platformService.createSharedResume(authUser, request.jobId());
    }

    @GetMapping("/shared-resumes")
    public ApiModels.PageResponse<ApiModels.SharedResumeView> sharedResumes(@AuthenticationPrincipal AuthUser authUser,
                                                                            @RequestParam(defaultValue = "0") int page,
                                                                            @RequestParam(defaultValue = "12") int size) {
        return platformService.listSharedResumes(page, size, authUser != null ? authUser.userId() : null);
    }

    @GetMapping("/shared-resumes/mine")
    public ApiModels.PageResponse<ApiModels.SharedResumeView> mySharedResumes(@AuthenticationPrincipal AuthUser authUser,
                                                                              @RequestParam(defaultValue = "0") int page,
                                                                              @RequestParam(defaultValue = "12") int size) {
        return platformService.mySharedResumes(authUser, page, size);
    }

    @GetMapping("/shared-resumes/{sharedResumeId}")
    public ApiModels.SharedResumeView sharedResume(@AuthenticationPrincipal AuthUser authUser,
                                                   @PathVariable String sharedResumeId) {
        return platformService.getSharedResume(sharedResumeId, authUser != null ? authUser.userId() : null);
    }

    @PostMapping("/shared-resumes/{sharedResumeId}/view")
    public ApiModels.CountResponse recordView(@PathVariable String sharedResumeId) {
        return platformService.recordView(sharedResumeId);
    }

    @PostMapping("/shared-resumes/{sharedResumeId}/use")
    public ApiModels.CountResponse recordUse(@PathVariable String sharedResumeId) {
        return platformService.recordUse(sharedResumeId);
    }

    @DeleteMapping("/shared-resumes/{sharedResumeId}")
    public ApiModels.BasicMessage deleteSharedResume(@AuthenticationPrincipal AuthUser authUser,
                                                     @PathVariable String sharedResumeId) {
        platformService.deleteSharedResume(authUser, sharedResumeId);
        return new ApiModels.BasicMessage("共享简历已删除");
    }
}
