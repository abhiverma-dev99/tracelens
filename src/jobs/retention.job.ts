import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';

export const initCronJobs = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('Running Data Retention Cron Job...');
    
    const days120Ago = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    try {
      const oldIncidents = await prisma.incident.findMany({
        where: { 
          status: 'RESOLVED', 
          updatedAt: { lt: days120Ago } 
        }
      });

      if (oldIncidents.length > 0) {
        await prisma.archivedIncident.createMany({
          data: oldIncidents.map(inc => ({
            id: inc.id,
            message: inc.message,
            stackTrace: inc.stackTrace,
            service: inc.service,
            status: inc.status,
            createdAt: inc.createdAt,
            updatedAt: inc.updatedAt
          }))
        });

        // Main table se delete karo
        await prisma.incident.deleteMany({
          where: { id: { in: oldIncidents.map(i => i.id) } }
        });
        console.log(`${oldIncidents.length} incidents archived.`);
      }

      const deletedArchives = await prisma.archivedIncident.deleteMany({
        where: { archivedAt: { lt: oneYearAgo } }
      });
      
      if (deletedArchives.count > 0) {
        console.log(`${deletedArchives.count} archived incidents permanently deleted.`);
      }

    } catch (error) {
      console.error('Retention Job Failed:', error);
    }
  });
};