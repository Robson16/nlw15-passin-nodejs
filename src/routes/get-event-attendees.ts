import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { NotFound } from '../_errors/not-found'
import { prisma } from '../lib/prisma'

export async function getEventAttendees(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/events/:eventId/attendees',
    {
      schema: {
        summary: 'Get event attendees',
        tags: ['events'],
        params: z.object({
          eventId: z.string().uuid(),
        }),
        querystring: z.object({
          search: z.string().nullish(),
          pageIndex: z.string().nullish().default('0').transform(Number),
          perPage: z.string().nullish().default('10').transform(Number),
        }),
        response: {
          200: z.object({
            attendees: z.array(
              z.object({
                id: z.number(),
                name: z.string(),
                email: z.string().email(),
                createdAt: z.date(),
                checkedInAt: z.date().nullable(),
              }),
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const { eventId } = request.params
      const { search, pageIndex, perPage } = request.query

      const event = await prisma.event.findFirst({
        where: {
          id: eventId,
        },
      })

      if (event === null) {
        throw new NotFound('Event not found.')
      }

      const attendees = await prisma.attendee.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          checkIn: {
            select: {
              createdAt: true,
            },
          },
        },
        where: search
          ? {
              eventId,
              name: {
                contains: search,
              },
            }
          : {
              eventId,
            },
        take: perPage,
        skip: pageIndex * perPage,
        orderBy: {
          createdAt: 'desc',
        },
      })

      return reply.send({
        attendees: attendees.map((attendee) => {
          return {
            id: attendee.id,
            name: attendee.name,
            email: attendee.email,
            createdAt: attendee.createdAt,
            checkedInAt: attendee.checkIn?.createdAt ?? null,
          }
        }),
      })
    },
  )
}
