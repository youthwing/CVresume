package com.crseume.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
public class VerificationMailService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER =
        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneId.of("Asia/Shanghai"));

    private final JavaMailSender javaMailSender;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${app.auth.mail.from-address:}")
    private String fromAddress;

    @Value("${app.auth.mail.from-name:CVResume 简历救兵}")
    private String fromName;

    public VerificationMailService(JavaMailSender javaMailSender) {
        this.javaMailSender = javaMailSender;
    }

    public void sendVerificationCode(String email, String code, String type, String locale, Instant expiresAt) {
        if (!StringUtils.hasText(mailHost) || !StringUtils.hasText(fromAddress)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "邮件服务未配置，请先配置 SMTP 参数");
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(email);
        message.setSubject(buildSubject(locale));
        message.setText(buildBody(code, type, locale, expiresAt));
        try {
            javaMailSender.send(message);
        } catch (MailException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "验证码邮件发送失败，请稍后重试");
        }
    }

    private String buildSubject(String locale) {
        if ("en".equalsIgnoreCase(locale)) {
            return "CVResume verification code";
        }
        return "%s 验证码".formatted(fromName);
    }

    private String buildBody(String code, String type, String locale, Instant expiresAt) {
        String action = switch (normalizeType(type)) {
            case "LOGIN" -> locale.equalsIgnoreCase("en") ? "log in" : "登录";
            case "REGISTER" -> locale.equalsIgnoreCase("en") ? "register" : "注册";
            default -> locale.equalsIgnoreCase("en") ? "verify your identity" : "验证身份";
        };
        String expiresAtText = DATE_TIME_FORMATTER.format(expiresAt);

        if ("en".equalsIgnoreCase(locale)) {
            return """
                Your CVResume verification code is: %s

                This code is used to %s and will expire at %s (Asia/Shanghai).
                If this wasn't you, please ignore this email.
                """.formatted(code, action, expiresAtText);
        }

        return """
            你的 CVResume 简历救兵验证码为：%s

            本次验证码用于%s，将在 %s（北京时间）失效。
            如果这不是你的操作，请忽略这封邮件。
            """.formatted(code, action, expiresAtText);
    }

    private String normalizeType(String type) {
        if (!StringUtils.hasText(type)) {
            return "AUTH";
        }
        return switch (type.trim().toUpperCase(Locale.ROOT)) {
            case "LOGIN", "REGISTER", "AUTH" -> type.trim().toUpperCase(Locale.ROOT);
            default -> "AUTH";
        };
    }
}
