# Contributing to Agent Charlie

Welcome to the Agent Charlie ecosystem! This guide covers contribution standards across all repositories in the platform.

---

## Repositories Overview

| Repository | Description | Tech Stack |
|------------|-------------|------------|
| **Agent-Charlie** | Monorepo with shared packages | TypeScript, Tamagui, Zod |
| **overlord-api** | Backend control plane API | Node.js, Fastify, TypeScript |
| **overlord-ui** | Mobile/web app interface | React Native, Expo, Tamagui |

---

## Git Workflow

### Branch Naming

```
<type>/<ticket-or-description>
```

| Type | Purpose | Example |
|------|---------|---------|
| `feat` | New features | `feat/voice-commands` |
| `fix` | Bug fixes | `fix/auth-token-refresh` |
| `refactor` | Code improvements | `refactor/api-response-wrapper` |
| `docs` | Documentation | `docs/api-endpoints` |
| `chore` | Maintenance tasks | `chore/update-dependencies` |
| `test` | Test additions | `test/voice-service-unit` |

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Examples:**
```bash
feat(voice): add Eleven Labs conversational AI integration
fix(auth): resolve token refresh race condition
refactor(api): consolidate response wrapper patterns
docs(readme): update installation instructions
chore(deps): upgrade Fastify to v5
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `docs` - Documentation only
- `style` - Formatting, missing semicolons, etc.
- `test` - Adding or updating tests
- `chore` - Maintenance tasks
- `perf` - Performance improvement
- `ci` - CI/CD changes

**Scopes (by repository):**

*Agent-Charlie:*
- `ui-kit`, `types`, `state`, `ai-services`

*overlord-api:*
- `registry`, `health`, `voice`, `auth`, `api`

*overlord-ui:*
- `screens`, `components`, `services`, `navigation`

### Pull Requests

1. Create feature branch from `main`
2. Make changes following coding standards below
3. Write/update tests as needed
4. Create PR with description:
   - What changed
   - Why it changed
   - How to test
5. Request review
6. Address feedback
7. Squash and merge

---

## Coding Standards

### TypeScript

- Strict mode enabled
- No `any` types (use `unknown` or proper typing)
- Export types alongside implementations
- Use Zod for runtime validation

```typescript
// Good
export interface ServiceConfig {
    name: string;
    baseUrl: string;
    timeout: number;
}

export const ServiceConfigSchema = z.object({
    name: z.string().min(1),
    baseUrl: z.string().url(),
    timeout: z.number().positive(),
});

// Bad
export interface ServiceConfig {
    name: any;
    config: object;
}
```

### File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Components | `PascalCase.tsx` | `VoiceChat.tsx` |
| Screens | `[Name]Screen.tsx` | `DashboardScreen.tsx` |
| Hooks | `use[Name].ts` | `useAuth.ts` |
| Services | `[name].ts` | `api.ts` |
| Types | `types.ts` or `I[Name].ts` | `IVoiceService.ts` |
| Routes | `[name].routes.ts` | `registry.routes.ts` |

### Directory Structure

**Frontend (React Native/Expo):**
```
src/
├── components/          # Reusable UI components
│   ├── atoms/           # Basic building blocks
│   ├── molecules/       # Composed components
│   └── organisms/       # Complex components
├── features/            # Feature modules
│   └── [feature]/
│       ├── components/
│       ├── hooks/
│       ├── screens/
│       └── types.ts
├── navigation/          # Navigation config
├── services/            # API clients
├── store/               # State management
└── types/               # Global types
```

**Backend (Clean Architecture):**
```
src/
├── domain/              # Core business logic
│   ├── [feature]/       # Domain entities
│   └── shared/          # Shared types, errors, guards
├── application/         # Business orchestration
│   └── [feature]/       # Services, interfaces
├── infrastructure/      # External implementations
│   └── [feature]/       # Repositories, adapters
└── api/                 # HTTP layer
    ├── v1/routes/       # Route definitions
    ├── middleware/      # Request handlers
    └── responses/       # Response wrappers
```

---

## Frontend Patterns (FrontEndCharlie)

### Component Pattern

```tsx
import { View, Text } from 'react-native';
import { useAuth } from '../store/AuthContext';

interface ServiceCardProps {
    service: Service;
    onPress?: () => void;
}

export function ServiceCard({ service, onPress }: ServiceCardProps) {
    return (
        <View style={styles.card}>
            <Text style={styles.name}>{service.name}</Text>
            <Text style={styles.status}>{service.status}</Text>
        </View>
    );
}
```

### Hook Pattern

```typescript
import { useState, useCallback } from 'react';

export function useServices() {
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchServices = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await api.getServices();
            setServices(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { services, isLoading, error, fetchServices };
}
```

### Avoid React Native Text Node Issues

```tsx
// CORRECT - No whitespace between View children
return (
    <View style={styles.container}>
        <View style={styles.header}>
            <Text>{'Title'}</Text>
        </View>
        <ScrollView>
            {items.map((item) => (
                <View key={item.id}>
                    <Text>{item.name}</Text>
                </View>
            ))}
        </ScrollView>
    </View>
);

// WRONG - Whitespace causes "Unexpected text node" errors
return (
    <View>
        {/* This comment on its own line can cause issues */}
        <Text>Hello</Text>
    </View>
);
```

---

## Backend Patterns (BackEndCharlie)

### Domain Entity Pattern

```typescript
// domain/registry/Service.ts
import { Guard } from '../shared/guards';

export class Service {
    constructor(props: ServiceProps) {
        Guard.stringNotEmpty(props.id, 'id');
        Guard.stringNotEmpty(props.name, 'name');
        Guard.validUrl(props.baseUrl, 'baseUrl');

        this.id = props.id;
        this.name = props.name;
        this.baseUrl = props.baseUrl;
    }

    public isAvailable(): boolean {
        return this._status === 'healthy';
    }

    public toSnapshot(): ServiceSnapshot {
        return { id: this.id, name: this.name, status: this._status };
    }
}
```

### Service Pattern

```typescript
// application/registry/RegistryService.ts
export class RegistryService {
    constructor(
        private readonly repository: IRegistryRepository,
        private readonly healthService: IHealthService
    ) {}

    async registerService(request: RegisterRequest): Promise<ServiceSnapshot> {
        const service = new Service({
            id: this.generateId(request.name),
            name: request.name,
            baseUrl: request.baseUrl
        });

        await this.repository.save(service);
        return service.toSnapshot();
    }
}
```

### API Response Pattern

```typescript
// api/responses/ApiResponse.ts
export interface ApiResponse<T> {
    success: boolean;
    statusCode: number;
    message: string;
    data?: T;
    timestamp: string;
}

export class ApiResponseBuilder {
    static ok<T>(data: T, message = 'Success'): ApiResponse<T> {
        return {
            success: true,
            statusCode: 200,
            message,
            data,
            timestamp: new Date().toISOString()
        };
    }
}
```

---

## Testing

### Unit Tests

- Test domain entities and services
- Mock external dependencies
- Test edge cases and error handling

```typescript
describe('Service', () => {
    it('should create valid service', () => {
        const service = new Service({
            id: 'test-service',
            name: 'Test Service',
            baseUrl: 'http://localhost:3000'
        });
        expect(service.id).toBe('test-service');
    });

    it('should throw on invalid URL', () => {
        expect(() => new Service({
            id: 'test',
            name: 'Test',
            baseUrl: 'not-a-url'
        })).toThrow();
    });
});
```

### Integration Tests

- Test API endpoints end-to-end
- Use test database/mocks
- Verify response formats

---

## Code Review Checklist

- [ ] Follows naming conventions
- [ ] No `any` types
- [ ] Error handling is appropriate
- [ ] Tests added/updated
- [ ] No console.log in production code
- [ ] No hardcoded secrets
- [ ] Documentation updated if needed
- [ ] TypeScript compiles without errors

---

## Development Setup

### Prerequisites

- Node.js 20+
- npm or yarn
- Git

### Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd <repo-name>

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and fill in required values:

```bash
cp .env.example .env
```

---

## Questions?

- Open an issue in the relevant repository
- Check existing documentation in `.claude/agents/`
- Review FrontEndCharlie.md or BackEndCharlie.md for detailed patterns

---

*This guide applies to all Agent Charlie repositories. Keep it updated as patterns evolve.*
