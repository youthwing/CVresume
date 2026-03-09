package com.crseume;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class CrseumeApplication {

    public static void main(String[] args) {
        SpringApplication.run(CrseumeApplication.class, args);
    }
}
