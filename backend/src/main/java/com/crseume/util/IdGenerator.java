package com.crseume.util;

import java.util.concurrent.atomic.AtomicLong;

public final class IdGenerator {

    private static final AtomicLong COUNTER = new AtomicLong(System.currentTimeMillis());

    private IdGenerator() {
    }

    public static String next(String prefix) {
        return prefix + COUNTER.incrementAndGet();
    }
}
