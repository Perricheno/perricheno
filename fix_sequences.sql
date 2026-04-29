SELECT setval(pg_get_serial_sequence('"User"', 'id'), coalesce(max(id),0) + 1, false) FROM "User";
SELECT setval(pg_get_serial_sequence('"Task"', 'id'), coalesce(max(id),0) + 1, false) FROM "Task";
SELECT setval(pg_get_serial_sequence('"Transaction"', 'id'), coalesce(max(id),0) + 1, false) FROM "Transaction";
SELECT setval(pg_get_serial_sequence('"UsageLog"', 'id'), coalesce(max(id),0) + 1, false) FROM "UsageLog";
SELECT setval(pg_get_serial_sequence('"PromoCode"', 'id'), coalesce(max(id),0) + 1, false) FROM "PromoCode";
SELECT setval(pg_get_serial_sequence('"PromoUsage"', 'id'), coalesce(max(id),0) + 1, false) FROM "PromoUsage";
SELECT setval(pg_get_serial_sequence('"SystemNotification"', 'id'), coalesce(max(id),0) + 1, false) FROM "SystemNotification";
SELECT setval(pg_get_serial_sequence('"LatexError"', 'id'), coalesce(max(id),0) + 1, false) FROM "LatexError";
