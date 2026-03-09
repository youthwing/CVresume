package com.crseume.config;

import com.crseume.domain.ApiModels;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.crseume.security.BearerTokenFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {

    private final List<String> allowedOriginPatterns;

    public SecurityConfig(
        @Value("${app.cors.allowed-origin-patterns:http://localhost:*,http://127.0.0.1:*,http://14.103.166.76,https://14.103.166.76}")
        String allowedOriginPatterns
    ) {
        this.allowedOriginPatterns = List.of(allowedOriginPatterns.split("\\s*,\\s*"));
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
                                            BearerTokenFilter bearerTokenFilter,
                                            ObjectMapper objectMapper) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(Customizer.withDefaults())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(exception -> exception
                .authenticationEntryPoint((request, response, authException) -> writeJsonError(response, objectMapper, 401, "请先登录"))
                .accessDeniedHandler((request, response, accessDeniedException) -> writeJsonError(response, objectMapper, 403, "没有权限访问")))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/error").permitAll()
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/send-code", "/api/auth/register", "/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/auth/oauth/providers", "/api/auth/oauth/*/authorize").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/oauth/*/callback").permitAll()
                .requestMatchers("/api/auth/me", "/api/auth/invitations", "/api/auth/profile").authenticated()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/shared-resumes/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/shared-resumes/*/view").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/shared-resumes/*/use").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/credits/packages").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/redemption/products").permitAll()
                .anyRequest().authenticated())
            .addFilterBefore(bearerTokenFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    private void writeJsonError(jakarta.servlet.http.HttpServletResponse response,
                                ObjectMapper objectMapper,
                                int status,
                                String message) throws java.io.IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(objectMapper.writeValueAsString(new ApiModels.BasicMessage(message)));
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(allowedOriginPatterns);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
