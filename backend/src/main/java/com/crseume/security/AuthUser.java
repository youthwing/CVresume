package com.crseume.security;

public record AuthUser(String token, String userId, String email, String role, boolean proMember) {
}
