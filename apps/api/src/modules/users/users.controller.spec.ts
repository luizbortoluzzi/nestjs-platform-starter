import { Test, TestingModule } from '@nestjs/testing';

import { UpdateUserDto } from './dto/update-user.dto';
import { UserEntity, UserRole } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function makeUser(): UserEntity {
  return Object.assign(new UserEntity(), {
    id: 'u1',
    email: 'alice@example.com',
    name: 'Alice',
    role: UserRole.USER,
  });
}

const currentUser: AuthenticatedUser = {
  id: 'u1',
  email: 'alice@example.com',
  role: UserRole.USER,
};

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<Pick<UsersService, 'findById' | 'update'>>;

  beforeEach(async () => {
    usersService = {
      findById: jest.fn().mockResolvedValue(makeUser()),
      update: jest.fn().mockResolvedValue(makeUser()),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get(UsersController);
  });

  describe('getMe', () => {
    it('calls usersService.findById with the current user id', async () => {
      const result = await controller.getMe(currentUser);
      expect(usersService.findById).toHaveBeenCalledWith('u1');
      expect(result).toEqual(makeUser());
    });
  });

  describe('updateMe', () => {
    it('calls usersService.update with the current user id and dto', async () => {
      const dto: UpdateUserDto = { name: 'Alice Updated' };
      const result = await controller.updateMe(currentUser, dto);
      expect(usersService.update).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual(makeUser());
    });
  });
});
