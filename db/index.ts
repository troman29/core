import type { DeepPartial, ObjectLiteral, Repository } from 'typeorm';

export const customRepository = {
  async getOrCreate<T extends ObjectLiteral>(
    this: Repository<T>,
    criteria: Partial<T>,
    defaultValues: DeepPartial<T>,
  ): Promise<T> {
    return this.manager.transaction(async (manager) => {
      try {
        let entity = await manager.findOne(this.metadata.target as any, {
          where: criteria,
        });

        if (!entity) {
          entity = this.create({
            ...criteria,
            ...defaultValues,
          });
          entity = await manager.save(this.metadata.target, entity);
        }

        return entity;
      } catch (error: any) {
        if (error.code === '23505') {
          throw new Error(`Entity with criteria ${JSON.stringify(criteria)} already exists`);
        }
        throw error;
      }
    });
  },
};
