package com.crseume.api;

import com.crseume.domain.ApiModels;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiModels.BasicMessage> handleResponseStatusException(ResponseStatusException exception) {
        String message = exception.getReason() == null || exception.getReason().isBlank()
            ? "请求处理失败"
            : exception.getReason();
        return ResponseEntity.status(exception.getStatusCode()).body(new ApiModels.BasicMessage(message));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiModels.BasicMessage> handleUnexpectedException(Exception exception) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ApiModels.BasicMessage("服务异常，请稍后重试"));
    }
}
