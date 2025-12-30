/**
 * Guard clauses for invariant enforcement
 * Following BackEndMate's AcrrmGuard pattern
 */

import { DomainError, ErrorCode } from '../errors';

export class Guard {
    /**
     * Ensures value is not null or undefined
     */
    static notNull<T>(value: T | null | undefined, paramName: string): T {
        if (value === null || value === undefined) {
            throw new DomainError(
                ErrorCode.VALIDATION_ERROR,
                `${paramName} cannot be null or undefined`,
                400
            );
        }
        return value;
    }

    /**
     * Ensures string is not null, undefined, or empty/whitespace
     */
    static stringNotEmpty(value: string | null | undefined, paramName: string): string {
        if (!value || value.trim().length === 0) {
            throw new DomainError(
                ErrorCode.VALIDATION_ERROR,
                `${paramName} cannot be null, empty, or whitespace`,
                400
            );
        }
        return value;
    }

    /**
     * Ensures number is positive (> 0)
     */
    static numberPositive(value: number, paramName: string): number {
        if (value <= 0) {
            throw new DomainError(
                ErrorCode.VALIDATION_ERROR,
                `${paramName} must be a positive number`,
                400
            );
        }
        return value;
    }

    /**
     * Ensures number is non-negative (>= 0)
     */
    static numberNonNegative(value: number, paramName: string): number {
        if (value < 0) {
            throw new DomainError(
                ErrorCode.VALIDATION_ERROR,
                `${paramName} must be a non-negative number`,
                400
            );
        }
        return value;
    }

    /**
     * Ensures array is not null and has at least one element
     */
    static arrayNotEmpty<T>(value: T[] | null | undefined, paramName: string): T[] {
        if (!value || value.length === 0) {
            throw new DomainError(
                ErrorCode.VALIDATION_ERROR,
                `${paramName} must contain at least one element`,
                400
            );
        }
        return value;
    }

    /**
     * Ensures value matches a valid URL format
     */
    static validUrl(value: string, paramName: string): string {
        try {
            new URL(value);
            return value;
        } catch {
            throw new DomainError(
                ErrorCode.VALIDATION_ERROR,
                `${paramName} must be a valid URL`,
                400
            );
        }
    }

    /**
     * Ensures value is one of the allowed enum values
     */
    static inEnum<T extends Record<string, string>>(
        value: string,
        enumType: T,
        paramName: string
    ): string {
        const validValues = Object.values(enumType);
        if (!validValues.includes(value)) {
            throw new DomainError(
                ErrorCode.VALIDATION_ERROR,
                `${paramName} must be one of: ${validValues.join(', ')}`,
                400
            );
        }
        return value;
    }
}

/**
 * Fluent null-checking extension (following BackEndMate's ThrowIfNull pattern)
 */
export function throwIfNull<T>(
    value: T | null | undefined,
    identifier?: string
): T {
    if (value === null || value === undefined) {
        throw new DomainError(
            ErrorCode.NOT_FOUND,
            `Resource${identifier ? ` '${identifier}'` : ''} was not found`,
            404
        );
    }
    return value;
}
