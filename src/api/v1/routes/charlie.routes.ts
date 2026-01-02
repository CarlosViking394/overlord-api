/**
 * Charlie Routes
 *
 * API endpoints for Charlie AI assistant.
 * Handles conversations, projects, and actions.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getCharlieService } from '../../../application/charlie/CharlieService';
import { CharlieRequest, UserRole } from '../../../application/charlie/types';

interface ConversationBody {
  message: string;
  sessionId?: string;
  userId?: string;
  userRole?: UserRole;
  projectId?: string;
}

interface ActionApprovalBody {
  approved: boolean;
}

interface CreateProjectBody {
  name: string;
  type: 'website' | 'api' | 'mobile' | 'library' | 'other';
  framework?: string;
}

export async function charlieRoutes(fastify: FastifyInstance) {
  const charlie = getCharlieService();

  // ===========================================================================
  // CONVERSATION ENDPOINTS
  // ===========================================================================

  /**
   * POST /charlie/chat - Send a message to Charlie
   */
  fastify.post<{ Body: ConversationBody }>(
    '/charlie/chat',
    async (request: FastifyRequest<{ Body: ConversationBody }>, reply: FastifyReply) => {
      try {
        const { message, sessionId, userId, userRole, projectId } = request.body;

        if (!message || typeof message !== 'string') {
          return reply.status(400).send({
            success: false,
            error: 'Message is required',
          });
        }

        const charlieRequest: CharlieRequest = {
          message,
          sessionId: sessionId || `session_${Date.now()}`,
          userId: userId || 'anonymous',
          userRole: userRole || 'OVERLORD',
          projectId,
        };

        const response = await charlie.processMessage(charlieRequest);

        return reply.send({
          success: true,
          data: response,
          sessionId: charlieRequest.sessionId,
        });
      } catch (error) {
        console.error('Charlie chat error:', error);
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * POST /charlie/actions/:actionId/approve - Approve or reject a pending action
   */
  fastify.post<{
    Params: { actionId: string };
    Body: ActionApprovalBody;
    Querystring: { sessionId: string };
  }>(
    '/charlie/actions/:actionId/approve',
    async (request, reply) => {
      try {
        const { actionId } = request.params;
        const { approved } = request.body;
        const { sessionId } = request.query;

        if (!sessionId) {
          return reply.status(400).send({
            success: false,
            error: 'sessionId is required',
          });
        }

        const result = await charlie.approveAction(sessionId, actionId, approved);

        return reply.send({
          success: result.success,
          message: result.message,
        });
      } catch (error) {
        console.error('Action approval error:', error);
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  // ===========================================================================
  // PROJECT ENDPOINTS
  // ===========================================================================

  /**
   * GET /charlie/projects - Get all projects for user
   */
  fastify.get<{ Querystring: { userId?: string } }>(
    '/charlie/projects',
    async (request, reply) => {
      try {
        const userId = request.query.userId || 'default';
        const projects = await charlie.getProjects(userId);

        return reply.send({
          success: true,
          data: projects,
        });
      } catch (error) {
        console.error('Get projects error:', error);
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * GET /charlie/projects/:projectId - Get a specific project
   */
  fastify.get<{ Params: { projectId: string } }>(
    '/charlie/projects/:projectId',
    async (request, reply) => {
      try {
        const { projectId } = request.params;
        const project = await charlie.getProject(projectId);

        if (!project) {
          return reply.status(404).send({
            success: false,
            error: 'Project not found',
          });
        }

        return reply.send({
          success: true,
          data: project,
        });
      } catch (error) {
        console.error('Get project error:', error);
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * POST /charlie/projects - Create a new project
   */
  fastify.post<{ Body: CreateProjectBody; Querystring: { userId?: string } }>(
    '/charlie/projects',
    async (request, reply) => {
      try {
        const { name, type, framework } = request.body;
        const userId = request.query.userId || 'default';

        if (!name || !type) {
          return reply.status(400).send({
            success: false,
            error: 'name and type are required',
          });
        }

        const project = await charlie.createProject(userId, name, type, framework);

        return reply.status(201).send({
          success: true,
          data: project,
        });
      } catch (error) {
        console.error('Create project error:', error);
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * GET /charlie/projects/:projectId/files - Get project file tree
   */
  fastify.get<{ Params: { projectId: string } }>(
    '/charlie/projects/:projectId/files',
    async (request, reply) => {
      try {
        const { projectId } = request.params;
        const files = await charlie.getProjectFiles(projectId);

        return reply.send({
          success: true,
          data: files,
        });
      } catch (error) {
        console.error('Get project files error:', error);
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  // ===========================================================================
  // SESSION ENDPOINTS
  // ===========================================================================

  /**
   * GET /charlie/session/:sessionId - Get session info
   */
  fastify.get<{ Params: { sessionId: string } }>(
    '/charlie/session/:sessionId',
    async (request, reply) => {
      try {
        const { sessionId } = request.params;
        const session = charlie.getSession(sessionId);

        if (!session) {
          return reply.status(404).send({
            success: false,
            error: 'Session not found',
          });
        }

        return reply.send({
          success: true,
          data: {
            id: session.id,
            userId: session.userId,
            userRole: session.userRole,
            messageCount: session.messages.length,
            createdAt: session.createdAt,
            lastActiveAt: session.lastActiveAt,
            activeProject: session.context.activeProject,
          },
        });
      } catch (error) {
        console.error('Get session error:', error);
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * DELETE /charlie/session/:sessionId - Clear session
   */
  fastify.delete<{ Params: { sessionId: string } }>(
    '/charlie/session/:sessionId',
    async (request, reply) => {
      try {
        const { sessionId } = request.params;
        const cleared = charlie.clearSession(sessionId);

        return reply.send({
          success: true,
          cleared,
        });
      } catch (error) {
        console.error('Clear session error:', error);
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  // ===========================================================================
  // INFO ENDPOINT
  // ===========================================================================

  /**
   * GET /charlie - Charlie API info
   */
  fastify.get('/charlie', async (request, reply) => {
    return reply.send({
      success: true,
      name: 'Charlie AI Assistant',
      version: '1.0.0',
      endpoints: {
        'POST /charlie/chat': 'Send a message to Charlie',
        'POST /charlie/actions/:id/approve': 'Approve/reject pending action',
        'GET /charlie/projects': 'Get all projects',
        'POST /charlie/projects': 'Create a new project',
        'GET /charlie/projects/:id': 'Get project details',
        'GET /charlie/projects/:id/files': 'Get project file tree',
        'GET /charlie/session/:id': 'Get session info',
        'DELETE /charlie/session/:id': 'Clear session',
      },
    });
  });
}
